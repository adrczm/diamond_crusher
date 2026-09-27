// Keyboard shortcuts for the web version. Keys are ignored while typing in a field, and when a modifier is held so the
// browser's own shortcuts (Cmd+R, Cmd+W) keep working. Does nothing on phones.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const STORE = 'dc-shortcuts-off';
let off = false;
try {
  off = typeof localStorage !== 'undefined' && localStorage.getItem(STORE) === '1';
} catch {
  // Storage blocked: shortcuts stay on.
}

/** Single-key shortcuts can be turned off (WCAG 2.1.4), e.g. for speech input. Remembered in this browser. */
export function shortcutsEnabled(): boolean {
  return !off;
}
export function setShortcutsEnabled(on: boolean) {
  off = !on;
  try {
    localStorage.setItem(STORE, on ? '0' : '1');
  } catch {
    // Not remembered; applies until reload.
  }
}

export type KeyMap = Record<string, (e: KeyboardEvent) => void>;

function typing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/** Map keys by `KeyboardEvent.key` ('s', '?', ' ', 'Escape'). Letters match either case. */
export function useHotkeys(map: KeyMap, enabled = true) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      // '?' stays on so the panel with the switch can always be reached.
      if (off && e.key !== '?' && e.key !== 'Escape') return;
      if (typing(e.target)) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const fn = ref.current[k] ?? ref.current[e.key];
      if (!fn) return;
      // Space on a focused button would also click it; let the shortcut win.
      e.preventDefault();
      fn(e);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
}
