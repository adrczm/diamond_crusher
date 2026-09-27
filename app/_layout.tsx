// Startup routing (07 PRIV-040, 09 ARCH-034): first run, lock, unreadable data, newer data, ready.
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setUuidGenerator } from '../src/data/ids';
import { logReminderAction } from '../src/data/repositories/reminders';
import { getSettings } from '../src/data/repositories/settings';
import type { SqlDb } from '../src/data/sql';
import { createFresh, startupRoute, type Bootstrap } from '../src/data/vault';
import { AppContext, relockAllowed } from '../src/features/app';
import { LockScreen, NewerScreen, UnreadableScreen } from '../src/features/screens/gate';
import { reconcileReminders } from '../src/features/reminderService';
import { files } from '../src/platform/files';
import { ACTION_DONE, ACTION_SNOOZE, lastResponse, onResponse, snooze, type Response } from '../src/platform/notifications';
import { installCryptoPolyfill } from '../src/platform/random';
import { Loading } from '../src/ui/kit';
import { ThemePrefContext, useColors, useIsDark, type ThemePref } from '../src/ui/theme';

installCryptoPolyfill();
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
        if (since != null && gate.boot.lock_enabled && relockAllowed() && Date.now() - since >= gate.boot.lock_timeout_s * 1000) {
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
        if (r.data.kind === 'session') router.push('/session');
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
    body = <UnreadableScreen appVersion={APP_VERSION} onFresh={(db2, boot) => setGate({ kind: 'ready', db: db2, boot })} />;
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
          <Themed>{body}</Themed>
        </ThemePrefContext.Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Themed({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const dark = useIsDark();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {children}
    </View>
  );
}

function Nav() {
  const c = useColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
