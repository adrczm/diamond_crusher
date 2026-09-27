// Every text and background pair the app draws must meet WCAG 2.2 AA in both light and dark mode:
// 4.5:1 for normal text, 3:1 for large text (24px+, or 19px+ bold) and for control outlines.
jest.mock('react-native', () => ({ useColorScheme: () => 'light' }));
import { palettes, type Colors } from '../../src/ui/theme';

function luminance(hex: string): number {
  const n = hex.replace('#', '').slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(n.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type Key = keyof Colors;
const TEXT = 4.5;
const LARGE = 3;

// [text, background, minimum ratio, where it appears]
const PAIRS: [Key | '#FFFFFF', Key, number, string][] = [
  ['text', 'bg', TEXT, 'screen text'],
  ['muted', 'bg', TEXT, 'secondary screen text'],
  ['link', 'bg', TEXT, 'quiet buttons'],
  ['text', 'card', TEXT, 'card text, secondary buttons, choice rows'],
  ['muted', 'card', TEXT, 'hints, chart labels'],
  ['link', 'card', TEXT, 'links in cards, chart table toggle'],
  ['text', 'soft', TEXT, 'soft cards, tap area'],
  ['muted', 'soft', TEXT, 'soft card notes'],
  ['link', 'soft', TEXT, 'quiet buttons in soft cards'],
  ['text', 'selected', TEXT, 'selected choice row'],
  ['muted', 'selected', TEXT, 'selected choice hint'],
  ['text', 'warnSoft', TEXT, 'warning cards (safety stops)'],
  ['muted', 'warnSoft', TEXT, 'warning card notes'],
  ['link', 'warnSoft', TEXT, 'quiet buttons in warning cards'],
  ['warn', 'warnSoft', TEXT, 'warning banner'],
  ['info', 'infoSoft', TEXT, 'info banner'],
  ['text', 'inputBg', TEXT, 'typed text'],
  ['muted', 'inputBg', TEXT, 'placeholder'],
  ['onPrimary', 'primary', TEXT, 'primary buttons, selected segments, pressed tap area'],
  ['#FFFFFF', 'danger', TEXT, 'danger buttons'],
  ['onSqueeze', 'squeeze', TEXT, 'session countdown while squeezing'],
  ['squeeze', 'bg', LARGE, 'session phase title (36px bold)'],
  ['primary', 'bg', LARGE, 'countdown numbers (56-72px bold)'],
  ['primary', 'soft', LARGE, 'session countdown while resting'],
  ['inputBorder', 'card', LARGE, 'field, radio, checkbox outlines'],
  ['primary', 'card', LARGE, 'selected radio and row outline'],
  ['focus', 'inputBg', LARGE, 'focus ring'],
  ['good', 'card', LARGE, 'streak dots'],
  ['text', 'hover', TEXT, 'hovered rows and cards (desktop)'],
  ['muted', 'hover', TEXT, 'hints in hovered rows'],
  ['onPrimary', 'primaryHover', TEXT, 'hovered primary button'],
  ['text', 'nav', TEXT, 'sidebar items'],
  ['muted', 'nav', TEXT, 'sidebar group labels, shortcut hints'],
  ['text', 'navHover', TEXT, 'hovered sidebar item'],
  ['text', 'navSelected', TEXT, 'current sidebar item'],
  ['muted', 'navSelected', TEXT, 'shortcut digit on the current item'],
  ['celebrate', 'card', LARGE, 'completion ring'],
  ['focus', 'nav', LARGE, 'focus ring in the sidebar'],
  ['celebrate', 'goodSoft', LARGE, 'completion mark'],
];

describe.each(Object.entries(palettes))('%s theme', (_, c) => {
  test.each(PAIRS)('%s on %s ≥ %d (%s)', (fg, bg, min) => {
    const f = fg.startsWith('#') ? fg : c[fg as Key];
    expect(contrast(f, c[bg])).toBeGreaterThanOrEqual(min);
  });
});
