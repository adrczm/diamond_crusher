// A number stepper whose value can also be typed (Q3, sessions a day): what a typed text and the arrow keys turn into.
// Kept out of the view so the rules can be tested in Node.

/** A typed whole number, kept between `min` and `max`; null when the text is not a whole number (the old value stays). */
export function parseCount(text: string, min: number, max: number): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isSafeInteger(n)) return null;
  return Math.max(min, Math.min(max, n));
}

/** Spinbutton keys (WAI-ARIA): ↑ and ↓ add or take 1, Home goes to the minimum, End to a finite maximum. Null: not a step key. */
export function stepKey(key: string | undefined, value: number, min: number, max: number): number | null {
  const next =
    key === 'ArrowUp' ? value + 1 : key === 'ArrowDown' ? value - 1 : key === 'Home' ? min : key === 'End' && Number.isFinite(max) ? max : null;
  return next == null ? null : Math.max(min, Math.min(max, next));
}
