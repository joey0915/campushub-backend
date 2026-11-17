import { existsSync } from 'node:fs';
import { isAbsolute, normalize } from 'node:path';

/**
 * The only files the auto-heal agent may read as context or patch: existing,
 * non-test TypeScript under src/. Tests and the Jest harness are excluded so a
 * failing assertion can only be fixed by changing the code it checks.
 */
export function isEditableSource(path: string): boolean {
  const normalized = normalize(path);
  return (
    !isAbsolute(normalized) &&
    normalized === path &&
    normalized.startsWith('src/') &&
    normalized.endsWith('.ts') &&
    !normalized.startsWith('src/test/') &&
    !normalized.includes('/__tests__/') &&
    !normalized.endsWith('.test.ts') &&
    existsSync(normalized)
  );
}
