// Optional event log (06a §4): leaks, sexual activity and notes about a day. Every item is skippable.
import { useState } from 'react';
import { View } from 'react-native';
import { Alert } from '../src/platform/dialog';
import { APP_QUESTION_LABEL, EVENTS } from '../src/content/en/items';
import { COMMON, ERRORS } from '../src/content/en/strings';
import {
  deleteContextFlag,
  deleteEvent,
  insertContextFlag,
  insertEvent,
  listContextFlags,
  listEvents,
  type ContextKind,
  type EjacBand,
  type LeakSituation,
} from '../src/data/repositories/events';
import { activeGoals, getProfile } from '../src/data/repositories/profile';
import { nowIso } from '../src/data/sql';
import { formatShort, formatTime, toLocalDate, tzOffsetMin } from '../src/domain/dates';
import { useApp, useLoad } from '../src/features/app';
import { leaveFlow } from '../src/features/screens/GuidedFlow';
import { Banner, Button, Card, Choice, Divider, Field, H2, Label, Loading, P, Row, Screen, Segments } from '../src/ui/kit';

type Kind = 'leak' | 'sex' | 'context';

export default function LogScreen() {
  const { db, bump } = useApp();
  const { data, reload, error: loadError } = useLoad(async (d) => ({
    profile: await getProfile(d),
    goals: await activeGoals(d),
    events: (await listEvents(d)).reverse(),
    flags: (await listContextFlags(d)).slice(-5).reverse(),
  }));
  const [kind, setKind] = useState<Kind | undefined>();
  const [when, setWhen] = useState<0 | 1 | 2>(0);
  const [situation, setSituation] = useState<LeakSituation | undefined>();
  const [amount, setAmount] = useState<'drops' | 'more' | undefined>();
  const [activity, setActivity] = useState<'penetrative_vaginal' | 'other_partnered' | 'solo' | undefined>();
  const [firm, setFirm] = useState<number | null | undefined>();
  const [band, setBand] = useState<EjacBand | undefined>();
  const [control, setControl] = useState<number | undefined>();
  const [bother, setBother] = useState<number | undefined>();
  const [ctx, setCtx] = useState<ContextKind | undefined>();
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(10);
  if (!data) return <Loading error={loadError} onRetry={reload} />;
  const anatomy = data.profile?.anatomy ?? 'other_unspecified';
  const male = anatomy === 'male';
  const whenOpts = [
    { value: 0 as const, label: EVENTS.now },
    { value: 1 as const, label: EVENTS.earlierToday },
    { value: 2 as const, label: EVENTS.yesterday },
  ];
  const occurred = () => {
    const d = new Date();
    if (when === 1) d.setHours(Math.max(0, d.getHours() - 3));
    if (when === 2) d.setDate(d.getDate() - 1);
    return d;
  };
  const reset = () => {
    setKind(undefined);
    setSituation(undefined);
    setAmount(undefined);
    setActivity(undefined);
    setFirm(undefined);
    setBand(undefined);
    setControl(undefined);
    setBother(undefined);
    setCtx(undefined);
    setNote('');
    setWhen(0);
  };
  // Answers typed so far, so Cancel can ask before it throws them away (DS-E9).
  const filled = !!(situation || amount || activity || firm !== undefined || band || control !== undefined || bother !== undefined || ctx || note.trim());
  const cancel = () => {
    if (!filled) return reset();
    Alert.alert(EVENTS.discardTitle, EVENTS.discardBody, [
      { text: COMMON.cancel, style: 'cancel' },
      { text: EVENTS.discard, style: 'destructive', onPress: reset },
    ]);
  };
  // One save per tap, and a failed save says so and keeps the answers (DS-E9).
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await write();
      bump();
      reload();
      reset();
      setSaved(true);
    } catch (e) {
      console.warn(e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const write = async () => {
    const at = occurred();
    const base = {
      occurred_at: at.toISOString(),
      local_date: toLocalDate(at),
      tz_offset_min: tzOffsetMin(at),
      entered_at: nowIso(),
      leak_situation: null,
      leak_amount: null,
      activity_type: null,
      hardness: null,
      ejac_time_band: null,
      ejac_time_min: null,
      control_0_10: null,
      bother_0_10: null,
      item_set_version: 1,
    };
    if (kind === 'leak') await insertEvent(db, { ...base, type: 'leak', leak_situation: situation ?? null, leak_amount: amount ?? null });
    if (kind === 'sex')
      await insertEvent(db, {
        ...base,
        type: 'sexual_activity',
        activity_type: activity ?? null,
        hardness: firm ?? null,
        ejac_time_band: band ?? null,
        control_0_10: control ?? null,
        bother_0_10: bother ?? null,
      });
    if (kind === 'context' && ctx) await insertContextFlag(db, { kind: ctx, from_date: toLocalDate(at), to_date: null, note: note.trim() ? note.trim().slice(0, 60) : null });
  };
  // A row names the day, time and details, so two leaks on one day can be told apart (DS-E9).
  const describe = (e: (typeof data.events)[number]) => {
    const time = e.occurred_at ? formatTime(new Date(e.occurred_at)) : '';
    const detail =
      e.type === 'leak'
        ? [EVENTS.situations.find((x) => x.value === e.leak_situation)?.label, EVENTS.amounts.find((x) => x.value === e.leak_amount)?.label].filter(Boolean).join(', ')
        : EVENTS.activities.find((x) => x.value === e.activity_type)?.label ?? '';
    return `${formatShort(e.local_date)}${time ? `, ${time}` : ''} · ${e.type === 'leak' ? EVENTS.leakType : EVENTS.sexType}${detail ? `: ${detail}` : ''}`;
  };
  const scale = Array.from({ length: 11 }, (_, i) => ({ value: i, label: String(i) }));
  const confirmDelete = (fn: () => Promise<void>) =>
    Alert.alert(COMMON.delete, EVENTS.deleteAsk, [
      { text: COMMON.cancel, style: 'cancel' },
      { text: COMMON.delete, style: 'destructive', onPress: () => fn().then(() => (bump(), reload())) },
    ]);

  return (
    <Screen
      title={EVENTS.title}
      footer={
        kind ? (
          <>
            <Button label={COMMON.save} onPress={save} busy={busy} disabled={kind === 'context' && !ctx} />
            <Button label={COMMON.cancel} kind="quiet" onPress={cancel} />
          </>
        ) : (
          <Button label={COMMON.done} kind="secondary" onPress={leaveFlow} />
        )
      }
    >
      {saved && !kind ? <Banner tone="success" text={EVENTS.saved} /> : null}
      {failed ? <Banner tone="critical" text={ERRORS.saveFailed} /> : null}
      <Choice
        options={[
          { value: 'leak' as const, label: EVENTS.leakType },
          ...(male ? [{ value: 'sex' as const, label: EVENTS.sexType }] : []),
          { value: 'context' as const, label: EVENTS.contextType },
        ]}
        value={kind}
        onChange={(k) => {
          setSaved(false);
          setKind(k);
        }}
      />
      {kind ? (
        <>
          <Label>{kind === 'sex' ? EVENTS.whenSex : EVENTS.when}</Label>
          <Segments label={kind === 'sex' ? EVENTS.whenSex : EVENTS.when} options={whenOpts} value={when} onChange={setWhen} />
        </>
      ) : null}
      {kind === 'leak' ? (
        <>
          <H2>{EVENTS.situation}</H2>
          <Choice
            options={EVENTS.situations.filter((s) => (s.profiles as readonly string[]).includes(anatomy)).map((s) => ({ value: s.value as LeakSituation, label: s.label }))}
            value={situation}
            onChange={setSituation}
          />
          <H2>{EVENTS.amount}</H2>
          <Segments label={EVENTS.amount} options={EVENTS.amounts.map((a) => ({ value: a.value as 'drops' | 'more', label: a.label }))} value={amount} onChange={setAmount} />
        </>
      ) : null}
      {kind === 'sex' ? (
        <>
          <H2>{EVENTS.activity}</H2>
          <Choice label={EVENTS.activity} options={EVENTS.activities.map((a) => ({ value: a.value, label: a.label }))} value={activity} onChange={setActivity} />
          {data.goals.includes('erection') ? (
            <>
              <H2>{EVENTS.firmness}</H2>
              <Choice label={EVENTS.firmness} options={EVENTS.firmnessOptions.map((o) => ({ value: o.value as number | null, label: o.label }))} value={firm} onChange={setFirm} />
            </>
          ) : null}
          {data.goals.includes('ejaculatory_control') ? (
            <>
              <H2>{EVENTS.time}</H2>
              <Choice label={EVENTS.time} options={EVENTS.timeOptions.map((o) => ({ value: o.value as EjacBand, label: o.label }))} value={band} onChange={setBand} />
              <H2>{EVENTS.control}</H2>
              <Segments label={EVENTS.control} options={scale} value={control} onChange={setControl} />
              <P small muted>{`0 = ${EVENTS.controlEnds[0]}, 10 = ${EVENTS.controlEnds[1]}`}</P>
              <H2>{EVENTS.bother}</H2>
              <Segments label={EVENTS.bother} options={scale} value={bother} onChange={setBother} />
              <P small muted>{`0 = ${EVENTS.botherEnds[0]}, 10 = ${EVENTS.botherEnds[1]}`}</P>
            </>
          ) : null}
        </>
      ) : null}
      {kind === 'context' ? (
        <>
          <Choice options={EVENTS.contextKinds.map((o) => ({ value: o.value as ContextKind, label: o.label }))} value={ctx} onChange={setCtx} />
          <Field label={EVENTS.contextNote} value={note} onChangeText={setNote} maxLength={60} />
        </>
      ) : null}
      {/* M8: LOG-003 keeps the label visible, but at the bottom so it does not lead the form. */}
      {kind && kind !== 'context' ? (
        <P small muted>
          {APP_QUESTION_LABEL}
        </P>
      ) : null}
      {!kind && (data.events.length || data.flags.length) ? (
        <Card>
          <Label>{EVENTS.recent}</Label>
          {data.events.slice(0, shown).map((e) => (
            <Row key={e.id}>
              <View style={{ flex: 1, minWidth: 180 }}>
                <P>{describe(e)}</P>
              </View>
              <Button
                label={COMMON.delete}
                kind="quiet"
                accessibilityLabel={EVENTS.deleteEntry(describe(e))}
                onPress={() => confirmDelete(() => deleteEvent(db, e.id))}
              />
            </Row>
          ))}
          {data.events.length > shown ? <Button label={EVENTS.showOlder} kind="quiet" onPress={() => setShown(shown + 20)} /> : null}
          {data.flags.length ? <Divider /> : null}
          {data.flags.map((f) => (
            <Row key={f.id}>
              <P>{`${formatShort(f.from_date)} · ${EVENTS.contextKinds.find((k) => k.value === f.kind)?.label ?? EVENTS.noteFallback}${f.note ? `: ${f.note}` : ''}`}</P>
              <Button label={COMMON.delete} kind="quiet" onPress={() => confirmDelete(() => deleteContextFlag(db, f.id))} />
            </Row>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}


