// Screens shown before the database is open: lock, unreadable data, data from a newer version (PRIV-040).
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_NAME, LOCK, UNREADABLE } from '../../content/en/strings';
import type { SqlDb } from '../../data/sql';
import { deleteEverything, startFreshAfterUnreadable, unlock, type Bootstrap, type Route } from '../../data/vault';
import { Button, H1, P } from '../../ui/kit';
import { space, useColors } from '../../ui/theme';

function Frame({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: space(3), paddingTop: insets.top + space(6), paddingBottom: insets.bottom + space(3), gap: space(2) }}>
      {children}
    </View>
  );
}

export function LockScreen({ boot, appVersion, onOpen }: { boot: Bootstrap; appVersion: string; onOpen: (r: Route) => void }) {
  const [busy, setBusy] = useState(false);
  const tryUnlock = async () => {
    setBusy(true);
    try {
      const r = await unlock(boot, appVersion);
      if (r !== 'cancelled') onOpen(r);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const erase = () =>
    Alert.alert(LOCK.erase, LOCK.eraseWarning, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: LOCK.erase,
        style: 'destructive',
        onPress: async () => {
          await deleteEverything(null);
          onOpen({ kind: 'first_run' });
        },
      },
    ]);
  return (
    <Frame>
      <H1>{LOCK.title}</H1>
      <P muted>{APP_NAME}</P>
      <View style={{ flex: 1 }} />
      <Button label={LOCK.unlock} onPress={tryUnlock} busy={busy} />
      <Button label={LOCK.erase} kind="quiet" onPress={erase} />
    </Frame>
  );
}

export function UnreadableScreen({ appVersion, onFresh }: { appVersion: string; onFresh: (db: SqlDb, boot: Bootstrap) => void }) {
  const [busy, setBusy] = useState(false);
  const fresh = () =>
    Alert.alert(UNREADABLE.fresh, UNREADABLE.confirm, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const r = await startFreshAfterUnreadable(appVersion);
            onFresh(r.db, r.boot);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  return (
    <Frame>
      <H1>{UNREADABLE.title}</H1>
      <P>{UNREADABLE.body}</P>
      <P muted>To import a backup file, start fresh first. The first screen then offers “Import a backup”.</P>
      <View style={{ flex: 1 }} />
      <Button label={UNREADABLE.fresh} kind="danger" onPress={fresh} busy={busy} />
    </Frame>
  );
}

export function NewerScreen() {
  return (
    <Frame>
      <H1>{UNREADABLE.title}</H1>
      <P>{UNREADABLE.newer}</P>
    </Frame>
  );
}
