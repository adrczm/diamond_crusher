// Export and import flows (PRIV-030 to PRIV-037), used by Your data and by the first screen.
import { useState } from 'react';
import { View } from 'react-native';
import { COMMON, DATA } from '../../content/en/strings';
import { BackupError, passphraseHint, passphraseOk } from '../../data/backup/container';
import type { Payload, Preview } from '../../data/backup/exportImport';
import { formatShort } from '../../domain/dates';
import { Banner, Button, Card, Choice, Field, H2, P } from '../../ui/kit';
import { useApp } from '../app';
import { applyImport, exportBackup, openBackup, pickBackupFile } from '../backupService';

export function ExportFlow({ onDone }: { onDone: () => void }) {
  const { db, boot, appVersion, bump } = useApp();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const hint = passphraseHint(p1);
  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await exportBackup(db, boot, appVersion, p1, (x) => setProgress(x));
      setMsg(DATA.exportDone);
      bump();
      setP1('');
      setP2('');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <H2>{DATA.exportTitle}</H2>
      <P muted>{DATA.exportBody}</P>
      <Field label={DATA.passphrase} value={p1} onChangeText={setP1} secureTextEntry autoCapitalize="none" autoCorrect={false} />
      {p1 ? <P small muted>{`${DATA.passphraseRule} ${DATA.strength[hint]}`}</P> : <P small muted>{DATA.passphraseRule}</P>}
      <Field label={DATA.passphraseAgain} value={p2} onChangeText={setP2} secureTextEntry autoCapitalize="none" autoCorrect={false} />
      {p2 && p1 !== p2 ? <P small muted>{DATA.passphraseMismatch}</P> : null}
      {busy ? <Banner tone="soft" text={`${DATA.working} ${Math.round(progress * 100)}%`} /> : null}
      {msg ? <Banner tone="soft" text={msg} /> : null}
      <Button label={DATA.export} onPress={run} busy={busy} disabled={!passphraseOk(p1) || p1 !== p2} />
      <Button label={COMMON.close} kind="quiet" onPress={onDone} disabled={busy} />
    </View>
  );
}

export function ImportFlow({ onDone, fresh = false }: { onDone: (imported: boolean) => void; fresh?: boolean }) {
  const { db, boot, setBoot, bump } = useApp();
  const [file, setFile] = useState<Uint8Array | null>(null);
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ payload: Payload; preview: Preview } | null>(null);
  const [how, setHow] = useState<'replace' | 'merge'>('replace');
  const [keep, setKeep] = useState<'this_phone' | 'backup'>('backup');

  const pick = async () => {
    setErr(null);
    const f = await pickBackupFile();
    if (f) setFile(f);
  };
  const open = async () => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      setOpened(await openBackup(file, pass, setProgress));
    } catch (e) {
      setErr(e instanceof BackupError && e.code !== 'wrong_passphrase_or_damaged' ? e.message : DATA.wrongPassphrase);
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    if (!opened) return;
    setBusy(true);
    try {
      const next = await applyImport(db, boot, opened.payload, fresh ? 'replace' : how, keep);
      setBoot(next);
      bump();
      onDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (opened) {
    const pv = opened.preview;
    return (
      <View style={{ gap: 12 }}>
        <H2>{DATA.previewTitle}</H2>
        <Card>
          <P>{DATA.previewLine(pv.sessions, pv.selfChecks, pv.questionnaires, pv.events)}</P>
          {pv.from && pv.to ? <P muted>{DATA.range(formatShort(pv.from), formatShort(pv.to))}</P> : null}
        </Card>
        {fresh ? null : (
          <>
            <Choice
              options={[
                { value: 'replace' as const, label: DATA.replace, hint: DATA.replaceNote },
                { value: 'merge' as const, label: DATA.merge, hint: DATA.mergeNote },
              ]}
              value={how}
              onChange={setHow}
            />
            {how === 'merge' ? (
              <Choice
                options={[
                  { value: 'this_phone' as const, label: DATA.keepPhone },
                  { value: 'backup' as const, label: DATA.keepBackup },
                ]}
                value={keep}
                onChange={setKeep}
              />
            ) : null}
          </>
        )}
        {err ? <Banner text={err} /> : null}
        <Button label={fresh ? DATA.import : how === 'replace' ? DATA.replace : DATA.merge} onPress={apply} busy={busy} />
        <Button label={COMMON.cancel} kind="quiet" onPress={() => onDone(false)} disabled={busy} />
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <H2>{DATA.importTitle}</H2>
      <P muted>{DATA.importBody}</P>
      <Button label={file ? 'Choose another file' : DATA.pickFile} kind="secondary" onPress={pick} disabled={busy} />
      <Field label={DATA.passphrase} value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" autoCorrect={false} />
      {busy ? <Banner tone="soft" text={`${DATA.working} ${Math.round(progress * 100)}%`} /> : null}
      {err ? <Banner text={err} /> : null}
      <Button label={DATA.unlockFile} onPress={open} busy={busy} disabled={!file || !pass} />
      <Button label={COMMON.cancel} kind="quiet" onPress={() => onDone(false)} disabled={busy} />
    </View>
  );
}
