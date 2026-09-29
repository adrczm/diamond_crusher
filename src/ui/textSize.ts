// In-app text size for the web version (DS-A9). Phones follow the system font size; Safari on a Mac has no such setting
// for web pages, so the Mac gets its own. Remembered in this browser only: it belongs to this screen, not to the records.
import { Platform } from 'react-native';

const STORE = 'dc-text-size';
export const TEXT_SIZES = [1, 1.15, 1.3, 1.5] as const;

let scale = 1;
try {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    const v = Number(localStorage.getItem(STORE));
    if ((TEXT_SIZES as readonly number[]).includes(v)) scale = v;
  }
} catch {
  // Storage blocked: normal size.
}

export function textScale(): number {
  return scale;
}

/** Saves the size and reloads the page, so every screen draws with it. */
export function setTextScale(v: number) {
  try {
    localStorage.setItem(STORE, String(v));
  } catch {
    // Not remembered.
  }
  if (typeof window !== 'undefined') window.location.reload();
}
