/** Helpers between `<input type="datetime-local">` values (local, no offset) and API times. */

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Formats a `Date` as `YYYY-MM-DDTHH:mm` in the browser's time zone. */
export function toLocalInputValue(date: Date): string {
  return (
    `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Parses a `datetime-local` value as local time; `null` when empty or invalid. */
export function parseLocalInputValue(value: string): Date | null {
  if (value.trim() === '') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The next full hour from `now`, a sensible default start for a new booking. */
export function nextFullHour(now: Date): Date {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

/** "Oct 27, 2026, 10:00 AM – 11:00 AM" for an API slot, in the browser's time zone. */
export function formatSlot(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const sameDay = start.toDateString() === end.toDateString();
  const endLabel = sameDay ? TIME_FORMAT.format(end) : DATE_TIME_FORMAT.format(end);
  return `${DATE_TIME_FORMAT.format(start)} – ${endLabel}`;
}
