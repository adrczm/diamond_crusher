// Calm, high-contrast palette for light and dark (spec 05 tone; ARCH polish: contrast).
import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

export interface Colors {
  bg: string;
  card: string;
  text: string;
  muted: string;
  primary: string;
  onPrimary: string;
  soft: string;
  border: string;
  danger: string;
  warn: string;
  warnSoft: string;
  good: string;
  squeeze: string;
  release: string;
}

const light: Colors = {
  bg: '#F6F6F3',
  card: '#FFFFFF',
  text: '#1B1D1C',
  muted: '#5A605E',
  primary: '#2B6B5E',
  onPrimary: '#FFFFFF',
  soft: '#E2EEEA',
  border: '#DCDDD8',
  danger: '#A8321F',
  warn: '#8A5A00',
  warnSoft: '#FBF0DA',
  good: '#2E7D4F',
  squeeze: '#2B6B5E',
  release: '#8FB8AE',
};

const dark: Colors = {
  bg: '#111413',
  card: '#1B1F1E',
  text: '#ECEEEC',
  muted: '#A2A9A6',
  primary: '#7CC4B2',
  onPrimary: '#0E1B18',
  soft: '#1E3430',
  border: '#2C3230',
  danger: '#F08C78',
  warn: '#F2C46B',
  warnSoft: '#3A3120',
  good: '#7FD1A0',
  squeeze: '#7CC4B2',
  release: '#3E6A60',
};

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

export const space = (n: number) => n * 8;
