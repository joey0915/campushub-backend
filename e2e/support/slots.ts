/** Time slots as the feature file phrases them ("tomorrow from 10:00 AM to 11:00 AM"). */
export interface Slot {
  readonly start: Date;
  readonly end: Date;
}

const CLOCK_TIME = /^(?<hour>1[0-2]|[1-9]):(?<minute>[0-5]\d) (?<meridiem>AM|PM)$/;

/** Tomorrow at a 12-hour clock time such as "2:00 PM", in the browser's (= this machine's) zone. */
export function tomorrowAt(clockTime: string): Date {
  const groups = CLOCK_TIME.exec(clockTime)?.groups;
  const hour = groups?.['hour'];
  const minute = groups?.['minute'];
  if (hour === undefined || minute === undefined) {
    throw new Error(`Expected a time like "10:00 AM", got "${clockTime}"`);
  }
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours((Number(hour) % 12) + (groups?.['meridiem'] === 'PM' ? 12 : 0), Number(minute));
  date.setSeconds(0, 0);
  return date;
}

export function tomorrowSlot(from: string, to: string): Slot {
  return { start: tomorrowAt(from), end: tomorrowAt(to) };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * `YYYY-MM-DDTHH:mm`, the value a `datetime-local` input takes. The client has
 * the same helper, but it lives in an ES-module package this CommonJS suite
 * cannot import from.
 */
export function toDateTimeLocal(date: Date): string {
  return (
    `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
