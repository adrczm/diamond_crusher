// Desktop layout (the web version on a Mac, or any wide window): a sidebar, a toolbar and wider pages instead of the
// phone's single column. See /mnt/project-files/research/desktop-ux/ for the research behind it.
// Design round 2 (Mac decision M1, 2026-10-03): the shell follows the window (Polaris md 768, lg 1040, xl 1440) and each
// page lays out by the width it really has (content classes c1 to c4). See research/design-notes-2026-09-30/mac/.
import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/** Polaris breakpoints: the desktop shell starts at md. */
export const BREAKPOINTS = { md: 768, lg: 1040, xl: 1440 } as const;
/** At this width and above the app uses the desktop shell (icon rail, then sidebar). */
export const DESKTOP_MIN = BREAKPOINTS.md;
/** Sidebar width (Polaris Navigation). */
export const SIDEBAR_W = 240;
/** Icon rail width at medium windows, or when the sidebar is collapsed. */
export const RAIL_W = 72;

export type WindowClass = 'compact' | 'medium' | 'large' | 'xlarge';

export function windowClass(width: number): WindowClass {
  if (width < BREAKPOINTS.md) return 'compact';
  if (width < BREAKPOINTS.lg) return 'medium';
  if (width < BREAKPOINTS.xl) return 'large';
  return 'xlarge';
}

export function useWindowClass(): WindowClass {
  return windowClass(useWindowDimensions().width);
}

export function useDesktop(): boolean {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_MIN;
}

/** Content sizes inside a page: c1 under 640, c2 to 959, c3 to 1279, c4 wider. */
export type ContentClass = 'c1' | 'c2' | 'c3' | 'c4';

export function contentClass(width: number): ContentClass {
  if (width < 640) return 'c1';
  if (width < 960) return 'c2';
  if (width < 1280) return 'c3';
  return 'c4';
}

/** Side-by-side columns need c3 or wider. */
export const TWO_COLUMNS_MIN = 960;

const FINE = '(hover: hover) and (pointer: fine)';

function fineNow(): boolean {
  try {
    return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(FINE).matches;
  } catch {
    return false;
  }
}

/** A mouse or trackpad (not touch): hover states, tooltips and 36 pt controls (Mac decision M4). */
export function usePointerFine(): boolean {
  const [fine, setFine] = useState(fineNow);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return;
    const m = window.matchMedia(FINE);
    const on = () => setFine(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return fine;
}

/** Keyboard and pointer extras only make sense in a browser. */
export const isWeb = Platform.OS === 'web';

export interface NavItem {
  key: 'home' | 'progress' | 'log' | 'check' | 'library' | 'reminders' | 'settings' | 'data';
  href: string;
  icon: string;
  group: 'train' | 'track' | 'app';
}

/** Sidebar sections, in order; keys 1 to 8 jump to them. */
export const NAV: readonly NavItem[] = [
  { key: 'home', href: '/', icon: '◎', group: 'train' },
  { key: 'library', href: '/library', icon: '❖', group: 'train' },
  { key: 'progress', href: '/progress', icon: '↗', group: 'track' },
  { key: 'log', href: '/log', icon: '✎', group: 'track' },
  { key: 'check', href: '/check', icon: '✓', group: 'track' },
  { key: 'reminders', href: '/reminders', icon: '◷', group: 'app' },
  { key: 'settings', href: '/settings', icon: '⚙', group: 'app' },
  { key: 'data', href: '/data', icon: '⇅', group: 'app' },
];

/** Guided flows run full-window without the sidebar, so nothing pulls attention away mid-exercise. */
const FOCUS = ['/onboarding', '/session', '/learn', '/selfcheck', '/questionnaire', '/screening'];

export function isFocusRoute(pathname: string): boolean {
  return FOCUS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

export function isSection(pathname: string): boolean {
  return NAV.some((n) => n.href === pathname);
}

/** Which sidebar item a page belongs to (sub-pages such as /about light up Settings). */
export function activeNav(pathname: string): NavItem['key'] | null {
  const hit = NAV.find((n) => n.href === pathname);
  if (hit) return hit.key;
  if (pathname === '/about') return 'settings';
  if (pathname === '/summary') return 'progress';
  if (pathname === '/sync') return 'data';
  return null;
}

/** Phone tab bar (UX audit H4). "More" opens Settings, which links to the other sections. */
export type TabKey = 'home' | 'progress' | 'log' | 'library' | 'more';
export const TABS: readonly { key: TabKey; href: string }[] = [
  { key: 'home', href: '/' },
  { key: 'progress', href: '/progress' },
  { key: 'log', href: '/log' },
  { key: 'library', href: '/library' },
  { key: 'more', href: '/settings' },
];

/** Stack screens that are tab roots on phones: no back arrow in their header. */
export const TAB_ROUTES = ['index', 'progress', 'log', 'library', 'settings'];

/**
 * Which tab is lit on a phone, or null to hide the tab bar. It shows only on the top-level sections, never in a
 * guided flow (these run full-screen, as on the desktop) or in the sync steps.
 */
export function phoneTab(pathname: string): TabKey | null {
  if (isFocusRoute(pathname) || !isSection(pathname)) return null;
  const a = activeNav(pathname);
  if (a === 'home' || a === 'progress' || a === 'log' || a === 'library') return a;
  return 'more';
}
