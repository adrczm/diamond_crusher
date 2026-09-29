// App-wide state: the open database, the bootstrap record, and a data version that screens reload on.
import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { SqlDb } from '../data/sql';
import type { Bootstrap } from '../data/vault';

export interface AppCtx {
  db: SqlDb;
  boot: Bootstrap;
  appVersion: string;
  version: number;
  /** Call after any write so open screens reload. */
  bump: () => void;
  setBoot: (b: Bootstrap) => void;
  /** Replace the whole app state (after delete-all or an import that needs a restart). */
  restart: () => void;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext missing');
  return ctx;
}

/** Loads data for a screen; reloads when data changes or the screen regains focus. */
export function useLoad<T>(loader: (db: SqlDb) => Promise<T>, deps: unknown[] = []): { data: T | null; reload: () => void; error: unknown } {
  const { db, version } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [n, setN] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    loader(db)
      .then((d) => alive.current && setData(d))
      .catch((e) => {
        console.warn(e);
        if (alive.current) setError(e);
      });
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, n, ...deps]);
  useFocusEffect(
    useCallback(() => {
      setN((x) => x + 1);
    }, [])
  );
  return { data, reload: () => setN((x) => x + 1), error };
}

// The share sheet, file picker and phone settings send the app to the background; that must not re-lock it.
let relockSuspended = 0;
export async function withoutRelock<T>(fn: () => Promise<T>): Promise<T> {
  relockSuspended++;
  try {
    return await fn();
  } finally {
    // Give the app a moment to come back to the foreground before re-enabling.
    setTimeout(() => {
      relockSuspended = Math.max(0, relockSuspended - 1);
    }, 1500);
  }
}
export function relockAllowed(): boolean {
  return relockSuspended === 0;
}

// A running session or timed test must survive a short phone call or a press of the power button (DS-E1). While one
// is on screen, the app re-locks only after RUN_GRACE_MS in the background (or the person's own longer time).
export const RUN_GRACE_MS = 15 * 60 * 1000;
let runHolds = 0;
export function holdLockForRun(): () => void {
  runHolds++;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    runHolds = Math.max(0, runHolds - 1);
  };
}
export function runInProgress(): boolean {
  return runHolds > 0;
}

// One session at a time (DS-E8): a double tap, a double click or a reminder tap must not open a second one.
let sessionOpen = false;
export function sessionScreenOpen(): boolean {
  return sessionOpen;
}
export function setSessionScreenOpen(open: boolean) {
  sessionOpen = open;
}
/** Opens the session screen once; further taps until it opens (or while it is open) do nothing. */
export function openSessionOnce(go: () => void) {
  if (sessionOpen) return;
  sessionOpen = true;
  go();
}
