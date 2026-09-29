// Startup routing (07 PRIV-040, 09 ARCH-034): first run, lock, unreadable data, newer data, ready.
import { DESKTOP } from '../src/content/en/strings';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { applyWebWording } from '../src/content/en/web';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setUuidGenerator } from '../src/data/ids';
import { logReminderAction } from '../src/data/repositories/reminders';
import { getSettings } from '../src/data/repositories/settings';
import type { SqlDb } from '../src/data/sql';
import { createFresh, startupRoute, type Bootstrap } from '../src/data/vault';
import { AppContext, relockAllowed, RUN_GRACE_MS, runInProgress, sessionScreenOpen } from '../src/features/app';
import { DesktopFrame } from '../src/features/screens/DesktopShell';
import { PhoneTabs } from '../src/features/screens/PhoneTabs';
import { LockScreen, NewerScreen, UnreadableScreen } from '../src/features/screens/gate';
import { reconcileReminders } from '../src/features/reminderService';
import { files } from '../src/platform/files';
import { ACTION_DONE, ACTION_SNOOZE, lastResponse, onResponse, snooze, type Response } from '../src/platform/notifications';
import { installCryptoPolyfill } from '../src/platform/random';
import { Loading } from '../src/ui/kit';
import { TAB_ROUTES, useDesktop } from '../src/ui/layout';
import { FONTS, ThemePrefContext, useColors, useIsDark, type ThemePref } from '../src/ui/theme';

installCryptoPolyfill();
if (Platform.OS === 'web') applyWebWording();
setUuidGenerator(() => Crypto.randomUUID());

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

type Gate =
  | { kind: 'loading' }
  | { kind: 'locked'; boot: Bootstrap }
  | { kind: 'unreadable' }
  | { kind: 'newer_version' }
  | { kind: 'ready'; db: SqlDb; boot: Bootstrap };

export default function RootLayout() {
  const [gate, setGate] = useState<Gate>({ kind: 'loading' });
  const [version, setVersion] = useState(0);
  const [themePref, setThemePref] = useState<ThemePref>('system');
  const [runId, setRunId] = useState(0);
  // Inter is bundled with the app, so this never touches the network.
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        files.clearTemp();
      } catch {
        // Nothing to clear.
      }
      const r = await startupRoute(APP_VERSION);
      if (!alive) return;
      if (r.kind === 'first_run') {
        const fresh = await createFresh(APP_VERSION);
        if (alive) setGate({ kind: 'ready', db: fresh.db, boot: fresh.boot });
      } else if (r.kind === 'ready') setGate({ kind: 'ready', db: r.db, boot: r.boot });
      else setGate(r);
    })().catch((e) => {
      console.warn('startup', e);
      if (alive) setGate({ kind: 'unreadable' });
    });
    return () => {
      alive = false;
    };
  }, [runId]);

  const db = gate.kind === 'ready' ? gate.db : null;
  useEffect(() => {
    if (!db) return;
    getSettings(db)
      .then((s) => setThemePref(s.theme))
      .catch(() => undefined);
  }, [db, version]);

  // PRIV-013: lock again after the chosen time in the background.
  const backgroundAt = useRef<number | null>(null);
  useEffect(() => {
    if (gate.kind !== 'ready') return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') backgroundAt.current = relockAllowed() ? Date.now() : null;
      if (s === 'active') {
        const since = backgroundAt.current;
        backgroundAt.current = null;
        const limit = runInProgress() ? Math.max(RUN_GRACE_MS, gate.boot.lock_timeout_s * 1000) : gate.boot.lock_timeout_s * 1000;
        if (since != null && gate.boot.lock_enabled && relockAllowed() && Date.now() - since >= limit) {
          const boot = gate.boot;
          gate.db.close().catch(() => undefined);
          setGate({ kind: 'locked', boot });
        } else {
          reconcileReminders(gate.db);
          setVersion((v) => v + 1);
        }
      }
    });
    return () => sub.remove();
  }, [gate]);

  // Reminder actions (REM-015, ARCH-049).
  const handleResponse = useCallback(
    async (r: Response) => {
      if (!db) return;
      const reminderId = typeof r.data.reminderId === 'string' ? r.data.reminderId : null;
      const at = typeof r.data.at === 'string' ? r.data.at : null;
      if (r.action === ACTION_SNOOZE) {
        await snooze(r.data, r.title, r.body);
        await logReminderAction(db, reminderId, 'snoozed', at);
      } else if (r.action === ACTION_DONE) {
        await logReminderAction(db, reminderId, 'done_already', at);
      } else {
        await logReminderAction(db, reminderId, 'opened', at);
        // A session already on screen stays the only one (DS-E8).
        if (r.data.kind === 'session') {
          if (!sessionScreenOpen()) router.push('/session');
        }
        else if (r.data.kind === 'monthly_check' || r.data.kind === 'quarterly_review') router.push('/check');
        else if (r.data.kind === 'weekly_summary') router.push('/summary');
      }
    },
    [db]
  );
  useEffect(() => {
    if (!db) return;
    reconcileReminders(db);
    lastResponse()
      .then((r) => r && handleResponse(r))
      .catch(() => undefined);
    return onResponse((r) => void handleResponse(r));
  }, [db, handleResponse]);

  let body: React.ReactNode;
  if (gate.kind === 'loading') body = <Loading />;
  else if (gate.kind === 'locked')
    body = (
      <LockScreen
        boot={gate.boot}
        appVersion={APP_VERSION}
        onOpen={(r) => {
          if (r.kind === 'ready') setGate({ kind: 'ready', db: r.db, boot: r.boot });
          else if (r.kind === 'first_run') setRunId((x) => x + 1);
          else if (r.kind !== 'locked') setGate(r);
        }}
      />
    );
  else if (gate.kind === 'unreadable')
    body = (
      <UnreadableScreen
        appVersion={APP_VERSION}
        onFresh={(db2, boot) => setGate({ kind: 'ready', db: db2, boot })}
        onRetry={() => {
          setGate({ kind: 'loading' });
          setRunId((x) => x + 1);
        }}
      />
    );
  else if (gate.kind === 'newer_version') body = <NewerScreen />;
  else
    body = (
      <AppContext.Provider
        value={{
          db: gate.db,
          boot: gate.boot,
          appVersion: APP_VERSION,
          version,
          bump: () => setVersion((v) => v + 1),
          setBoot: (b) => setGate({ kind: 'ready', db: gate.db, boot: b }),
          restart: () => {
            setGate({ kind: 'loading' });
            setRunId((x) => x + 1);
          },
        }}
      >
        <Nav />
      </AppContext.Provider>
    );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemePrefContext.Provider value={themePref}>
          <Themed>{fontsLoaded || fontError ? body : <Loading />}</Themed>
        </ThemePrefContext.Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Themed({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const pref = useContext(ThemePrefContext);
  const dark = useIsDark();
  // Navigation draws its own backgrounds behind headers and screens; give it the app's colours so nothing light shows
  // through in dark mode (or dark in light mode).
  const base = dark ? DarkTheme : DefaultTheme;
  useEffect(() => {
    // Behind the app: Android's window background (seen during rotation and keyboard), and on the web the page
    // background, scrollbars and form controls, so the chosen appearance wins over the system's.
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => undefined);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.colorScheme = dark ? 'dark' : 'light';
      root.style.setProperty('--dc-focus', c.focus);
      document.body.style.background = c.bg;
      try {
        // Read by public/theme-boot.js on the next load, before the app starts.
        if (pref === 'system') localStorage.removeItem('dc-theme');
        else localStorage.setItem('dc-theme', pref);
      } catch {
        // Storage blocked.
      }
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.bg);
    }
  }, [c, dark, pref]);
  const nav: Theme = {
    ...base,
    colors: { ...base.colors, primary: c.link, background: c.bg, card: c.card, text: c.text, border: c.border, notification: c.danger },
  };
  return (
    <ThemeProvider value={nav}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        {children}
      </View>
    </ThemeProvider>
  );
}

function Nav() {
  const c = useColors();
  // Wide windows (the Mac) get a sidebar and draw their own toolbar (see Screen); phones keep the native header and
  // get a bottom tab bar. Tab roots have no back arrow and switch without a slide, like tabs.
  const desktop = useDesktop();
  return (
    <DesktopFrame>
      <Stack
        screenOptions={({ route }) => {
          const tabRoot = !desktop && TAB_ROUTES.includes(route.name);
          return {
            headerStyle: { backgroundColor: c.card },
            headerTintColor: c.text,
            headerTitleStyle: { fontFamily: FONTS.semibold, fontSize: 17 },
            headerShadowVisible: true,
            headerBackTitle: DESKTOP.back,
            contentStyle: { backgroundColor: c.bg },
            animation: desktop || tabRoot ? 'none' : 'slide_from_right',
            ...(tabRoot ? { headerBackVisible: false, headerLeft: () => null } : null),
          };
        }}
      />
      <PhoneTabs />
    </DesktopFrame>
  );
}
