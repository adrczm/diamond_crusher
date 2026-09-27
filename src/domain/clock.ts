// Clock times as HH:MM text (08 REM-003 slot times, REM-032 knack time).

/** A whole 24-hour time, "00:00" to "23:59". */
export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Adds hours and minutes to an HH:MM time, wrapping at midnight. */
export function shiftTime(hhmm: string, dh: number, dm: number): string {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10) || 0);
  const total = ((((h + dh) * 60 + m + dm) % 1440) + 1440) % 1440;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Moves the minutes one step along a grid (e.g. 5 minutes); a time off the grid lands on it first. */
export function stepMinutes(hhmm: string, step: number, dir: 1 | -1): string {
  const m = parseInt(hhmm.split(':')[1] ?? '0', 10) || 0;
  const off = m % step;
  if (off === 0) return shiftTime(hhmm, 0, dir * step);
  return shiftTime(hhmm, 0, dir > 0 ? step - off : -off);
}
