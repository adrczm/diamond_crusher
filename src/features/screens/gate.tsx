// Screens shown before the database is open: lock, unreadable data, data from a newer version (PRIV-040).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Alert } from '../../platform/dialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_NAME, COMMON, LOCK, UNREADABLE } from '../../content/en/strings';
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
      { text: COMMON.cancel, style: 'cancel' },
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

/** DS-E2: any start-up error lands here, so Try again comes first and erasing is the quiet, confirmed last step. */
export function UnreadableScreen({ appVersion, onFresh, onRetry }: { appVersion: string; onFresh: (db: SqlDb, boot: Bootstrap) => void; onRetry: () => void }) {
  const [busy, setBusy] = useState(false);
  const fresh = () =>
    Alert.alert(UNREADABLE.fresh, UNREADABLE.confirm, [
      { text: COMMON.cancel, style: 'cancel' },
      {
        text: COMMON.continue,
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
      <P>{UNREADABLE.tryFirst}</P>
      <P muted>{UNREADABLE.importHint}</P>
      <View style={{ flex: 1 }} />
      <Button label={COMMON.tryAgain} onPress={onRetry} />
      <Button label={UNREADABLE.fresh} kind="quiet" onPress={fresh} busy={busy} />
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
