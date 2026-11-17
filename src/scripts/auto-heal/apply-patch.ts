import { readFileSync, writeFileSync } from 'node:fs';

import { isEditableSource } from './editable-source';

/**
 * CI-only (Lab 8): applies the auto-heal agent's JSON answer to the working
 * tree and writes a Markdown summary for the fix PR. Every edit is an exact,
 * unique search/replace in a non-test src/ file; anything else rejects the
 * whole answer before a single file is written.
 *
 * Usage: ts-node src/scripts/auto-heal/apply-patch.ts <response-file> <summary.md>
 */

interface SourceEdit {
  readonly path: string;
  readonly search: string;
  readonly replace: string;
}

interface AgentAnswer {
  readonly diagnosis: string;
  readonly edits: readonly SourceEdit[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSourceEdit(value: unknown): value is SourceEdit {
  return (
    isRecord(value) &&
    typeof value.path === 'string' &&
    typeof value.search === 'string' &&
    value.search !== '' &&
    typeof value.replace === 'string'
  );
}

function isAgentAnswer(value: unknown): value is AgentAnswer {
  return (
    isRecord(value) &&
    typeof value.diagnosis === 'string' &&
    Array.isArray(value.edits) &&
    value.edits.length > 0 &&
    value.edits.every(isSourceEdit)
  );
}

/** Models sometimes wrap JSON in a Markdown fence; the object itself is all we read. */
function parseAnswer(raw: string): AgentAnswer {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end < start) {
    throw new Error('Agent response contains no JSON object.');
  }
  const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
  if (!isAgentAnswer(parsed)) {
    throw new Error(
      'Agent response does not match { diagnosis, edits: [{ path, search, replace }] }.',
    );
  }
  return parsed;
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** Resolves every edit in memory first, so a bad edit leaves the tree untouched. */
function patchedFiles(edits: readonly SourceEdit[]): Map<string, string> {
  const files = new Map<string, string>();
  for (const { path, search, replace } of edits) {
    if (!isEditableSource(path)) {
      throw new Error(`Refusing to edit ${path}: only existing non-test src/ files may change.`);
    }
    const content = files.get(path) ?? readFileSync(path, 'utf8');
    const matches = countOccurrences(content, search);
    if (matches !== 1) {
      throw new Error(
        `Search text must match ${path} exactly once; it matched ${String(matches)}.`,
      );
    }
    // Slicing instead of String.replace keeps `$&`-style sequences in the patch literal.
    const at = content.indexOf(search);
    files.set(path, content.slice(0, at) + replace + content.slice(at + search.length));
  }
  return files;
}

function main(): void {
  const [responsePath, summaryPath] = process.argv.slice(2);
  if (responsePath === undefined || summaryPath === undefined) {
    throw new Error('Usage: apply-patch.ts <response-file> <summary.md>');
  }
  const answer = parseAnswer(readFileSync(responsePath, 'utf8'));
  const files = patchedFiles(answer.edits);
  for (const [path, content] of files) {
    writeFileSync(path, content);
  }

  const fileList = [...files.keys()].map((path) => `- \`${path}\``).join('\n');
  writeFileSync(
    summaryPath,
    `### Agent diagnosis\n\n${answer.diagnosis}\n\n### Files patched\n\n${fileList}\n`,
  );
  console.log(`Applied ${String(answer.edits.length)} edit(s) to:\n${fileList}`);
}

main();
