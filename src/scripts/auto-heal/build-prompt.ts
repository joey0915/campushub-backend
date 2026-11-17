import { readFileSync, writeFileSync } from 'node:fs';

import { isEditableSource } from './editable-source';

/**
 * CI-only (Lab 8): turns a failing Jest run into the user prompt for the
 * auto-heal agent in .github/workflows/ci.yml. Inputs arrive as arguments, not
 * environment variables, so this job stays outside src/config/env.ts.
 *
 * Usage: ts-node src/scripts/auto-heal/build-prompt.ts <test-results.log> <diff.patch> <out.md>
 */

// Budgets keep the prompt on the failure: the report's head, the change, and
// the files it implicates, not every passing test or unrelated module.
const LOG_BUDGET = 9_000;
const DIFF_BUDGET = 4_000;
const SOURCE_BUDGET = 14_000;

const INSTRUCTION =
  'Parse the attached Jest failure log. Locate the source code causing the failure in src/ ' +
  'and generate a patch that fixes the bug without breaking existing tests.';

// eslint-disable-next-line no-control-regex -- matching the ANSI escape byte is the point
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;
const SRC_PATH_PATTERN = /(?<![\w./-])src\/[\w./-]+\.ts/g;
const DIFF_FILE_PATTERN = /^\+\+\+ b\/(src\/\S+\.ts)$/gm;

interface PromptInputs {
  readonly logPath: string;
  readonly diffPath: string;
  readonly outPath: string;
}

function parseArgs(argv: readonly string[]): PromptInputs {
  const [logPath, diffPath, outPath] = argv;
  if (logPath === undefined || diffPath === undefined || outPath === undefined) {
    throw new Error('Usage: build-prompt.ts <test-results.log> <diff.patch> <out.md>');
  }
  return { logPath, diffPath, outPath };
}

function truncate(text: string, budget: number): string {
  return text.length <= budget ? text : `${text.slice(0, budget)}\n… [truncated]`;
}

/** Keeps Jest's failure report (from the first `●` block on), without colours or the repo prefix. */
function failureExcerpt(rawLog: string): string {
  const log = rawLog.replace(ANSI_PATTERN, '').replaceAll(`${process.cwd()}/`, '');
  const firstFailure = log.indexOf('●');
  const excerpt = firstFailure === -1 ? log.slice(-LOG_BUDGET) : log.slice(firstFailure);
  return truncate(excerpt, LOG_BUDGET);
}

/** Files the change touched come first: a regression most likely lives in the diff. */
function contextFiles(diff: string, log: string): string[] {
  const fromDiff = [...diff.matchAll(DIFF_FILE_PATTERN)].map((match) => match[1] ?? '');
  const fromLog = log.match(SRC_PATH_PATTERN) ?? [];
  return [...new Set([...fromDiff, ...fromLog])].filter(isEditableSource);
}

function sourceSection(paths: readonly string[]): string {
  let remaining = SOURCE_BUDGET;
  const sections: string[] = [];
  for (const path of paths) {
    const content = readFileSync(path, 'utf8');
    if (content.length > remaining) {
      continue;
    }
    remaining -= content.length;
    sections.push(`### ${path}\n\n\`\`\`ts\n${content}\`\`\``);
  }
  if (sections.length === 0) {
    throw new Error('No editable src/ file was found in the failure log or the diff.');
  }
  return sections.join('\n\n');
}

function main(): void {
  const { logPath, diffPath, outPath } = parseArgs(process.argv.slice(2));
  const log = failureExcerpt(readFileSync(logPath, 'utf8'));
  const diff = readFileSync(diffPath, 'utf8');
  const files = contextFiles(diff, log);

  const prompt = [
    INSTRUCTION,
    `## Jest failure log (test-results.log)\n\n\`\`\`text\n${log}\n\`\`\``,
    `## Diff of this change against its base (src/ only)\n\n\`\`\`diff\n${
      diff.trim() === '' ? '(no src/ changes in the diff)' : truncate(diff, DIFF_BUDGET)
    }\n\`\`\``,
    `## Source files you may edit\n\n${sourceSection(files)}`,
  ].join('\n\n');

  writeFileSync(outPath, `${prompt}\n`);
  console.log(`Auto-heal prompt written to ${outPath} with context: ${files.join(', ')}`);
}

main();
