// Colours, spacing, radius and type from Shopify's Polaris design system, in light and dark (spec 05 tone; ARCH polish: contrast).
import { createContext, useContext } from 'react';
import { useColorScheme, type TextStyle } from 'react-native';
import { polaris } from './polaris';

export interface Colors {
  bg: string;
  card: string;
  text: string;
  muted: string;
  /** Brand fill: primary buttons, selected controls. */
  primary: string;
  onPrimary: string;
  /** Quiet tinted surface (secondary cards, secondary buttons). */
  soft: string;
  border: string;
  danger: string;
  warn: string;
  warnSoft: string;
  good: string;
  squeeze: string;
  /** Text on the squeeze fill. */
  onSqueeze: string;
  release: string;
  link: string;
  info: string;
  infoSoft: string;
  goodSoft: string;
  dangerSoft: string;
  selected: string;
  inputBg: string;
  inputBorder: string;
  /** Off track of switches: at least 3:1 on every surface (WCAG 1.4.11), like Polaris border-emphasis. */
  controlOff: string;
  focus: string;
  /** Pointer hover on cards, rows and secondary buttons (desktop). */
  hover: string;
  primaryHover: string;
  /** Desktop sidebar: background, hovered item, selected item. */
  nav: string;
  navHover: string;
  navSelected: string;
  /** Celebration accent (session complete, full week). */
  celebrate: string;
}

// Shopify Polaris tokens (generated into ./polaris.ts). Polaris's dark theme is still experimental and leaves the tinted
// surfaces (warning, info, success, critical) and their text at light values, so light text landed on light tints.
// Dark mode uses its own tints below; test/ui/contrast.test.ts checks every text and background pair the app draws.
const DARK = {
  soft: '#3A3A3A',
  selected: '#454545',
  warn: '#FFD68A',
  warnSoft: '#3D2E0A',
  info: '#B4DCFF',
  infoSoft: '#0F2C45',
  goodSoft: '#0F3A2C',
  dangerSoft: '#4A1119',
  // Polaris's dark nav tokens are still the light values; the sidebar sits one step darker than the page.
  nav: '#141414',
  navHover: '#262626',
  navSelected: '#333333',
  hover: '#3A3A3A',
};
function fromPolaris(t: (typeof polaris)['light'] | (typeof polaris)['dark'], dark: boolean): Colors {
  return {
    bg: t['bg'],
    card: t['bg-surface'],
    text: t['text'],
    muted: t['text-secondary'],
    primary: t['bg-fill-brand'],
    onPrimary: t['text-brand-on-bg-fill'],
    soft: dark ? DARK.soft : t['bg-surface-secondary'],
    border: dark ? t['border-secondary'] : t['border'],
    danger: t['bg-fill-critical'],
    warn: dark ? DARK.warn : t['text-warning'],
    warnSoft: dark ? DARK.warnSoft : t['bg-surface-warning'],
    good: dark ? '#29B28A' : t['bg-fill-success'],
    squeeze: dark ? '#4B9CFF' : t['bg-fill-emphasis'],
    onSqueeze: dark ? t['bg'] : t['text-brand-on-bg-fill'],
    release: t['bg-fill-info'],
    link: dark ? '#6FB1FF' : t['text-link'],
    info: dark ? DARK.info : t['text-info'],
    infoSoft: dark ? DARK.infoSoft : t['bg-surface-info'],
    goodSoft: dark ? DARK.goodSoft : t['bg-surface-success'],
    dangerSoft: dark ? DARK.dangerSoft : t['bg-surface-critical'],
    selected: dark ? DARK.selected : t['bg-surface-selected'],
    inputBg: dark ? t['bg-surface'] : t['input-bg-surface'],
    inputBorder: t['input-border'],
    // The generated border-emphasis token is the focus blue, so the off track uses the input outline grey.
    controlOff: t['input-border'],
    focus: dark ? '#6FB1FF' : t['border-focus'],
    hover: dark ? DARK.hover : t['bg-surface-hover'],
    primaryHover: t['bg-fill-brand-hover'],
    nav: dark ? DARK.nav : t['nav-bg'],
    navHover: dark ? DARK.navHover : t['nav-bg-surface-hover'],
    navSelected: dark ? DARK.navSelected : t['nav-bg-surface-selected'],
    celebrate: dark ? '#29B28A' : t['bg-fill-success'],
  };
}

const light = fromPolaris(polaris.light, false);
const dark = fromPolaris(polaris.dark, true);

/** Both palettes, for the contrast test. */
export const palettes = { light, dark };

export type ThemePref = 'system' | 'light' | 'dark';

export const ThemePrefContext = createContext<ThemePref>('system');

export function useColors(): Colors {
  const pref = useContext(ThemePrefContext);
  const scheme = useColorScheme();
  const mode = pref === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : pref;
  return mode === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  const pref = useContext(ThemePrefContext);
  const scheme = useColorScheme();
  return pref === 'dark' || (pref === 'system' && scheme === 'dark');
}

/** Spacing in 8px steps (Polaris space-200 = 8px, space-400 = 16px). */
export const space = (n: number) => n * polaris.space['200'];

/** Polaris motion: durations (ms) and easing. */
export const motion = polaris.motion;

/** Polaris corner radii. */
export const radius = {
  sm: polaris.radius['100'],
  md: polaris.radius['200'],
  lg: polaris.radius['300'],
  xl: polaris.radius['400'],
  full: 999,
};

/** Inter, the Polaris typeface, in the four static weights the app loads (see app/_layout.tsx). */
export const FONTS = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Maps a numeric weight to the matching Inter file. Android ignores fontWeight on custom fonts. */
export function fontFor(weight?: TextStyle['fontWeight'] | number): TextStyle {
  const w = weight == null || weight === 'normal' ? 400 : weight === 'bold' ? 700 : Number(weight);
  const family = w >= 700 ? FONTS.bold : w >= 600 ? FONTS.semibold : w >= 500 ? FONTS.medium : FONTS.regular;
  return { fontFamily: family, fontWeight: 'normal' };
}

export type TypeVariant = keyof typeof polaris.typography;

/** A Polaris text variant (light-mobile sizes: body 16/24, headings bold). */
export function type(variant: TypeVariant): TextStyle {
  const t = polaris.typography[variant];
  return { fontSize: t.fontSize, lineHeight: t.lineHeight, letterSpacing: t.letterSpacing, ...fontFor(t.fontWeight) };
}
