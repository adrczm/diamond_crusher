// Timed tests must not count time the person could not see (DS-E12): when the app leaves the screen (a call, the power
// button, another app), `onInterrupt` runs once.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export function useInterruption(onInterrupt: () => void) {
  const cb = useRef(onInterrupt);
  cb.current = onInterrupt;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') cb.current();
    });
    return () => sub.remove();
  }, []);
}
