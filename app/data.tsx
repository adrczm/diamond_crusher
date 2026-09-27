// Backup and data (07 PRIV-030 to PRIV-050): what is stored, backup file export and import, delete everything.
// A missing or old backup shows as a warning, and the web shows if the browser keeps the data (UX audit C3).
import { useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { COMMON, DATA } from '../src/content/en/strings';
import { SYNC } from '../src/content/en/sync';
import { getMeta } from '../src/data/repositories/misc';
import { getPeer } from '../src/data/sync/changes';
import { deleteEverything } from '../src/data/vault';
import { backupAgeDays, backupState } from '../src/domain/backup';
import { formatShort, toLocalDate } from '../src/domain/dates';
import { useApp, useLoad } from '../src/features/app';
import { ExportFlow, ImportFlow } from '../src/features/screens/BackupFlows';
import { idb } from '../src/platform/idb';
import { Banner, Button, Card, Field, H2, Label, Loading, P, Screen } from '../src/ui/kit';

export default function DataScreen() {
  const { db, restart, bump } = useApp();
  const { data, reload } = useLoad(async (d) => ({
    meta: await getMeta(d),
    paired: !!(await getPeer(d)),
    persisted: Platform.OS === 'web' ? await idb.persisted() : null,
  }));
  const [mode, setMode] = useState<'view' | 'export' | 'import' | 'delete'>('view');
  const [word, setWord] = useState('');
  const [done, setDone] = useState<string | null>(null);
  if (!data) return <Loading />;
  if (mode === 'export')
    return (
      <Screen title={DATA.title}>
        <ExportFlow
          onDone={() => {
            // bump() also updates the backup status in the desktop sidebar.
            bump();
            reload();
            setMode('view');
          }}
        />
      </Screen>
    );
  if (mode === 'import')
    return (
      <Screen title={DATA.title}>
        <ImportFlow
          onDone={(ok) => {
            if (ok) setDone(DATA.importDone);
            reload();
            setMode('view');
          }}
        />
      </Screen>
    );
  if (mode === 'delete')
    return (
      <Screen title={DATA.deleteTitle}>
        <H2>{DATA.deleteTitle}</H2>
        <P>{DATA.deleteBody}</P>
        <P muted>{DATA.deleteNote}</P>
        <Field label={DATA.deleteType} value={word} onChangeText={setWord} autoCapitalize="characters" autoCorrect={false} />
        <Button
          label={DATA.deleteButton}
          kind="danger"
          disabled={word.trim() !== DATA.deleteWord}
          onPress={async () => {
            await deleteEverything(db);
            restart();
          }}
        />
        <Button label={COMMON.cancel} kind="quiet" onPress={() => setMode('view')} />
      </Screen>
    );
  const lastOn = data.meta?.last_export_at ? toLocalDate(new Date(data.meta.last_export_at)) : null;
  const last = lastOn ? formatShort(lastOn) : null;
  const today = toLocalDate(new Date());
  const state = backupState(Platform.OS === 'web' ? 'web' : 'native', lastOn, today);
  return (
    <Screen title={DATA.title}>
      {done ? <Banner tone="soft" text={done} /> : null}
      {state === 'never' ? <Banner text={DATA.noBackupWarn} /> : null}
      {state === 'stale' ? <Banner text={DATA.staleWarn(backupAgeDays(lastOn, today) ?? 0)} /> : null}
      <Card>
        <P>{DATA.lastBackup(last)}</P>
        <P small muted>
          {DATA.updateNote}
        </P>
        <Button label={DATA.export} onPress={() => setMode('export')} />
        <Button label={DATA.import} kind="secondary" onPress={() => setMode('import')} />
      </Card>
      {Platform.OS === 'web' ? (
        <Card tone={data.persisted ? 'normal' : 'warn'}>
          <Label>{DATA.storageTitle}</Label>
          <P>{data.persisted ? DATA.storageKept : data.persisted === false ? DATA.storageNotKept : DATA.storageUnknown}</P>
        </Card>
      ) : null}
      <Card>
        <Label>{DATA.whatTitle}</Label>
        <P>{DATA.what}</P>
        <Label>{DATA.whereTitle}</Label>
        <P>{DATA.where}</P>
        <Label>{DATA.leavesTitle}</Label>
        <P>{DATA.leaves}</P>
        <Label>{DATA.backupsTitle}</Label>
        <P>{DATA.backups}</P>
      </Card>
      <Card>
        <Label>{SYNC.entryTitle}</Label>
        <P>{SYNC.entryBody}</P>
        <Button label={data.paired ? SYNC.entryButtonPaired : SYNC.entryButton} onPress={() => router.push('/sync')} />
      </Card>
      <Button label={DATA.deleteAll} kind="quiet" onPress={() => setMode('delete')} />
    </Screen>
  );
}
