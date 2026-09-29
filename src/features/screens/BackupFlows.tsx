// Export and import flows (PRIV-030 to PRIV-037), used by Your data and by the first screen.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { COMMON, DATA } from '../../content/en/strings';
import { BackupError, passphraseHint, passphraseOk } from '../../data/backup/container';
import type { Payload, Preview } from '../../data/backup/exportImport';
import { formatShort } from '../../domain/dates';
import { Alert } from '../../platform/dialog';
import { Banner, Button, Card, Choice, Field, H2, P } from '../../ui/kit';
import { useApp } from '../app';
import { applyImport, backupErrorText, devicePreview, exportBackup, openBackup, pickBackupFile, recordExport } from '../backupService';

export function ExportFlow({ onDone }: { onDone: () => void }) {
  const { db, boot, appVersion, bump } = useApp();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState<{ text: string; tone: 'success' | 'critical' | 'warn' } | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const hint = passphraseHint(p1);
  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      setAsking(await exportBackup(db, boot, appVersion, p1, (x) => setProgress(x)));
    } catch (e) {
      console.warn(e);
      setMsg({ text: backupErrorText(e, DATA.errors), tone: 'critical' });
    } finally {
      setBusy(false);
    }
  };
  const answer = async (yes: boolean) => {
    const at = asking;
    setAsking(null);
    if (!yes || !at) return setMsg({ text: DATA.savedNotYet, tone: 'warn' });
    await recordExport(db, at);
    bump();
    setP1('');
    setP2('');
    setMsg({ text: DATA.exportDone, tone: 'success' });
  };
  if (asking) {
    return (
      <View style={{ gap: 12 }}>
        <H2>{DATA.savedAsk}</H2>
        <P muted>{DATA.savedAskNote}</P>
        <Button label={DATA.savedYes} onPress={() => void answer(true)} />
        <Button label={DATA.savedNo} kind="secondary" onPress={() => void answer(false)} />
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <H2>{DATA.exportTitle}</H2>
      <P muted>{DATA.exportBody}</P>
      <Field label={DATA.passphrase} value={p1} onChangeText={setP1} secureTextEntry autoCapitalize="none" autoCorrect={false} />
      {p1 ? <P small muted>{`${DATA.passphraseRule} ${DATA.strength[hint]}`}</P> : <P small muted>{DATA.passphraseRule}</P>}
      <Field label={DATA.passphraseAgain} value={p2} onChangeText={setP2} secureTextEntry autoCapitalize="none" autoCorrect={false} />
      {p2 && p1 !== p2 ? <P small muted>{DATA.passphraseMismatch}</P> : null}
      {busy ? <Banner tone="soft" text={`${DATA.working} ${Math.round(progress * 100)}%`} /> : null}
      {msg ? <Banner tone={msg.tone} text={msg.text} /> : null}
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
  const [here, setHere] = useState<Preview | null>(null);
  useEffect(() => {
    if (!fresh) devicePreview(db).then(setHere, () => setHere(null));
  }, [db, fresh]);

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
      const o = await openBackup(file, pass, setProgress);
      setOpened(o);
      // Records on this device after the file's last day would be lost by Replace, so Merge comes first (DS-E4).
      if (here?.to && (!o.preview.to || here.to > o.preview.to)) setHow('merge');
    } catch (e) {
      setErr(e instanceof BackupError && e.code !== 'wrong_passphrase_or_damaged' ? backupErrorText(e, DATA.errors) : DATA.wrongPassphrase);
    } finally {
      setBusy(false);
    }
  };
  const apply = () => {
    if (!fresh && how === 'replace' && here && (here.sessions || here.selfChecks || here.events)) {
      Alert.alert(DATA.replaceAsk, DATA.replaceAskBody, [
        { text: COMMON.cancel, style: 'cancel' },
        { text: DATA.replace, style: 'destructive', onPress: () => void applyNow() },
      ]);
    } else void applyNow();
  };
  const applyNow = async () => {
    if (!opened) return;
    setBusy(true);
    try {
      const next = await applyImport(db, boot, opened.payload, fresh ? 'replace' : how, keep);
      setBoot(next);
      bump();
      onDone(true);
    } catch (e) {
      console.warn(e);
      setErr(backupErrorText(e, DATA.errors));
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
          {here && !fresh ? <P muted>{DATA.thisDevice(here.sessions, here.selfChecks, here.questionnaires, here.events)}</P> : null}
        </Card>
        {here?.to && !fresh && (!pv.to || here.to > pv.to) ? <Banner tone="warn" text={DATA.newerHere(pv.to ? formatShort(pv.to) : '–')} /> : null}
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
        {err ? <Banner tone="critical" text={err} /> : null}
        <Button label={fresh ? DATA.import : how === 'replace' ? DATA.replace : DATA.merge} onPress={apply} busy={busy} />
        <Button label={COMMON.cancel} kind="quiet" onPress={() => onDone(false)} disabled={busy} />
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <H2>{DATA.importTitle}</H2>
      <P muted>{DATA.importBody}</P>
      <Button label={file ? DATA.chooseAnother : DATA.pickFile} kind="secondary" onPress={pick} disabled={busy} />
      <Field label={DATA.passphrase} value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" autoCorrect={false} />
      {busy ? <Banner tone="soft" text={`${DATA.working} ${Math.round(progress * 100)}%`} /> : null}
      {err ? <Banner tone="critical" text={err} /> : null}
      <Button label={DATA.unlockFile} onPress={open} busy={busy} disabled={!file || !pass} />
      <Button label={COMMON.cancel} kind="quiet" onPress={() => onDone(false)} disabled={busy} />
    </View>
  );
}
