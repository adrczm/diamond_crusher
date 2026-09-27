import { useEffect, useRef, useState } from 'react';

/** Seconds left, counting down from `seconds` while `running`. Calls `onDone` once at zero. */
export function useCountdown(seconds: number, running: boolean, onDone?: () => void): number {
  const [left, setLeft] = useState(seconds);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    setLeft(seconds);
    if (!running) return;
    const start = Date.now();
    const id = setInterval(() => {
      const l = Math.max(0, seconds - Math.floor((Date.now() - start) / 1000));
      setLeft(l);
      if (l <= 0) {
        clearInterval(id);
        done.current?.();
      }
    }, 200);
    return () => clearInterval(id);
  }, [seconds, running]);
  return left;
}
