/** Narrows a parsed JSON value to a plain object: not `null` and not an array. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// The contract's date-time pattern, with field ranges narrowed to what format: date-time allows.
const CALENDAR_DATE = String.raw`(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))`;
const CLOCK_TIME = String.raw`(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?`;
const UTC_OFFSET = String.raw`(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)`;
const ISO_DATE_TIME = new RegExp(`^${CALENDAR_DATE}T${CLOCK_TIME}${UTC_OFFSET}$`);

/**
 * True for an ISO 8601 (RFC 3339) date-time with an explicit offset, `Z` or
 * `±HH:MM`, such as `2026-10-01T10:00:00Z`. Impossible calendar dates such as
 * 2026-02-30 are rejected, which `Date.parse` alone would roll over into March.
 */
export function isIsoDateTime(value: string): boolean {
  const calendarDate = ISO_DATE_TIME.exec(value)?.[1];
  if (calendarDate === undefined) {
    return false;
  }
  const midnight = new Date(`${calendarDate}T00:00:00Z`);
  return !Number.isNaN(midnight.getTime()) && midnight.toISOString().startsWith(calendarDate);
}
