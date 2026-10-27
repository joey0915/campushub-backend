/**
 * Joins CSS-module class names, skipping falsy ones. Module classes are typed
 * `string | undefined` under `noUncheckedIndexedAccess`, so they cannot be
 * interpolated into a template string directly.
 */
export function cx(...classNames: readonly (string | false | null | undefined)[]): string {
  return classNames
    .filter((name): name is string => typeof name === 'string' && name !== '')
    .join(' ');
}
