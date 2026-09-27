// Desktop layout (the web version on a Mac, or any wide window): a sidebar, a toolbar and wider pages instead of the
// phone's single column. See /mnt/project-files/research/desktop-ux/ for the research behind it.
import { Platform, useWindowDimensions } from 'react-native';

/** At this width and above the app uses the desktop layout (between Polaris md 768 and lg 1040). */
export const DESKTOP_MIN = 900;
/** Sidebar width (Polaris Navigation is 240). */
export const SIDEBAR_W = 248;

export function useDesktop(): boolean {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_MIN;
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
