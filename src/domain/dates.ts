// Local-date helpers. Dates are 'YYYY-MM-DD' strings in the user's calendar (07 §3.1).

export type LocalDate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalDate(d: Date): LocalDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function tzOffsetMin(d: Date): number {
  return -d.getTimezoneOffset();
}

function toUtcMs(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): LocalDate {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(date: LocalDate, n: number): LocalDate {
  return fromUtcMs(toUtcMs(date) + n * 86400000);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86400000);
}

/** ISO weekday: Monday = 1 … Sunday = 7. */
export function isoWeekday(date: LocalDate): number {
  const day = new Date(toUtcMs(date)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** First day of the week containing `date`, for a week that starts on `weekStartDay` (ISO 1-7). */
export function weekStart(date: LocalDate, weekStartDay: number): LocalDate {
  const back = (isoWeekday(date) - weekStartDay + 7) % 7;
  return addDays(date, -back);
}

export function datesBetween(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a < b ? a : b;
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a > b ? a : b;
}

/** Local wall-clock Date for a date and 'HH:MM'. */
export function atLocalTime(date: LocalDate, hhmm: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Tue 14 Oct" */
export function formatShort(date: LocalDate): string {
  const [, m, d] = date.split('-').map(Number);
  return `${DAYS[isoWeekday(date) - 1]} ${d} ${MONTHS[m - 1]}`;
}

export function formatDuration(totalS: number): string {
  const s = Math.round(totalS);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} s`;
  return r === 0 ? `${m} min` : `${m} min ${r} s`;
}

/** Clock time in the device's own style (12- or 24-hour, DS-A19), e.g. "14:10" or "2:10 PM". */
export function formatTime(at: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(at);
  } catch {
    return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  }
}
