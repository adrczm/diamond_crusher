// Motion that respects "Reduce motion" (macOS Accessibility, Android "Remove animations").
// The setting is read once at start and kept up to date here, so a new screen knows it on its first frame (DS-A21).
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

let known = false;
const listeners = new Set<(v: boolean) => void>();
function set(v: boolean) {
  known = v;
  listeners.forEach((l) => l(v));
}
try {
  AccessibilityInfo.isReduceMotionEnabled()
    .then(set)
    .catch(() => undefined);
  AccessibilityInfo.addEventListener('reduceMotionChanged', set);
} catch {
  // Not available (tests): motion stays on.
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(known);
  useEffect(() => {
    setReduced(known);
    listeners.add(setReduced);
    return () => {
      listeners.delete(setReduced);
    };
  }, []);
  return reduced;
}
