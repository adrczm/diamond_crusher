// Colour cross-fades (MO-5): mix two '#RRGGBB' theme colours, so a change of tone is one event, not a flip.
import { useEffect, useRef, useState } from 'react';

function rgb(hex: string): [number, number, number] {
  const n = hex.replace('#', '');
  const h = n.length === 3 ? n.replace(/./g, (x) => x + x) : n.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0) as [number, number, number];
}

const hex2 = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');

/** `a` at t = 0, `b` at t = 1. */
export function mixColor(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  if (k === 0) return a;
  if (k === 1) return b;
  const x = rgb(a);
  const y = rgb(b);
  return `#${hex2(x[0] + (y[0] - x[0]) * k)}${hex2(x[1] + (y[1] - x[1]) * k)}${hex2(x[2] + (y[2] - x[2]) * k)}`;
}

/** ui.fast: 150 ms ease-out (motion-design.md 3.1). */
export const FADE_MS = 150;

/** Ease-out for a fade, 0 to 1. */
export function fadeOut(x: number): number {
  const v = Math.max(0, Math.min(1, x));
  return 1 - (1 - v) * (1 - v) * (1 - v);
}

const frame: (cb: () => void) => unknown =
  typeof requestAnimationFrame === 'function' ? (cb) => requestAnimationFrame(cb) : (cb) => setTimeout(cb, 16);
const cancel = (id: unknown) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id as number) : clearTimeout(id as ReturnType<typeof setTimeout>));

/** A colour that fades to `target` over 150 ms whenever the target changes. A colour change is not motion, so it stays on with Reduce motion. */
export function useColorFade(target: string, ms = FADE_MS): string {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const current = useRef(target);
  useEffect(() => {
    if (current.current === target) return;
    from.current = current.current;
    const start = Date.now();
    let id: unknown;
    const step = () => {
      const k = fadeOut((Date.now() - start) / ms);
      const c = mixColor(from.current, target, k);
      current.current = c;
      setShown(c);
      if (k < 1) id = frame(step);
    };
    step();
    return () => cancel(id);
  }, [target, ms]);
  return shown;
}
