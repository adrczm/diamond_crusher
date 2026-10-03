// The event log form (06a §4): leaks, sexual activity and notes about a day. Every item is skippable.
// One form for the Log page and for a quick log from anywhere (the L key on the Mac): `LogForm` shows the form with its
// own Save at the end; `useLogForm` gives the parts, so the phone Log page can keep Save in its bottom bar.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Alert } from '../../platform/dialog';
import { APP_QUESTION_LABEL, EVENTS } from '../../content/en/items';
import { COMMON, ERRORS } from '../../content/en/strings';
import { insertContextFlag, insertEvent, type EjacBand, type LeakSituation } from '../../data/repositories/events';
import { activeGoals, getProfile } from '../../data/repositories/profile';
import { nowIso } from '../../data/sql';
import { tzOffsetMin } from '../../domain/dates';
import { adjustForDay, defaultDay, savedTime, type When } from '../../domain/when';
import { Icon } from '../../ui/icons';
import { Banner, Button, Choice, Field, H2, Label, P, Segments, type PressState, useTouch } from '../../ui/kit';
import { Text } from '../../ui/text';
import { radius, space, type, useColors } from '../../ui/theme';
import { useApp, useLoad } from '../app';
import { DayStrip, TimeOfDaySlider } from './WhenPicker';

export type LogKind = 'leak' | 'sex' | 'context';

export interface LogFormProps {
  /** Called after a save ('saved') or when Cancel clears the form ('cancelled'). */
  onDone?: (result: 'saved' | 'cancelled') => void;
  /** Open with this type already picked (e.g. a quick log of a leak). */
  initialType?: LogKind;
}

/** The counter shows from this many characters (near the 280 limit). */
const COUNT_FROM = 240;

/** The three log types as large tiles: a different control from the answer lists below it (round 2 Log). */
function TypeTiles({ options, value, onChange }: { options: { value: LogKind; label: string }[]; value: LogKind | undefined; onChange: (k: LogKind) => void }) {
  const c = useColors();
  const touch = useTouch();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={EVENTS.typeLabel} style={{ flexDirection: 'row', gap: space(1) }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={(st) => ({
              flex: 1,
              minWidth: 0,
              minHeight: touch + 24,
              paddingHorizontal: space(1),
              paddingVertical: space(1),
              borderRadius: radius.lg,
              borderWidth: on ? 2 : 1,
              borderColor: on ? c.primary : c.inputBorder,
              backgroundColor: on ? c.primary : (st as PressState).hovered ? c.hover : c.card,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              opacity: st.pressed ? 0.85 : 1,
            })}
          >
            {/* A tick as well as the colour marks the chosen type. */}
            {on ? <Icon name="done" size={16} color={c.onPrimary} /> : <View style={{ height: 16 }} />}
            <Text style={[type('heading-sm'), { color: on ? c.onPrimary : c.text, textAlign: 'center' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface LogFormParts {
  ready: boolean;
  kind: LogKind | undefined;
  /** The type tiles and the questions. */
  body: ReactNode;
  /** Save and Cancel at the end of the form, right-aligned, with the ⌘↵ hint (the Mac and the quick-log panel). */
  inlineActions: ReactNode;
  /** The phone's bottom bar: Save and Cancel while a type is picked, else null. */
  footer: ReactNode;
  /** A just-saved entry, for the page's "Saved" banner. */
  saved: boolean;
}

export function useLogForm({ onDone, initialType }: LogFormProps = {}): LogFormParts {
  const { db, bump } = useApp();
  const { data } = useLoad(async (d) => ({ profile: await getProfile(d), goals: await activeGoals(d) }));
  const [now, setNow] = useState(() => new Date());
  const [kind, setKind] = useState<LogKind | undefined>(initialType);
  const [day, setDay] = useState(() => defaultDay(new Date()));
  const [when, setWhen] = useState<When>('now');
  const [situation, setSituation] = useState<LeakSituation | undefined>();
  const [amount, setAmount] = useState<'drops' | 'more' | undefined>();
  const [activity, setActivity] = useState<'penetrative_vaginal' | 'other_partnered' | 'solo' | undefined>();
  const [firm, setFirm] = useState<number | null | undefined>();
  const [band, setBand] = useState<EjacBand | undefined>();
  const [control, setControl] = useState<number | undefined>();
  const [bother, setBother] = useState<number | undefined>();
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // The Now marker follows the clock while the form is open.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setWhen((w) => adjustForDay(w, day, now));
  }, [day, now]);

  const anatomy = data?.profile?.anatomy ?? 'other_unspecified';
  const male = anatomy === 'male';
  const canSave = !!kind && (kind !== 'context' || note.trim().length > 0);

  const reset = () => {
    const n = new Date();
    setNow(n);
    setKind(undefined);
    setDay(defaultDay(n));
    setWhen('now');
    setSituation(undefined);
    setAmount(undefined);
    setActivity(undefined);
    setFirm(undefined);
    setBand(undefined);
    setControl(undefined);
    setBother(undefined);
    setNote('');
  };
  // Answers typed so far, so Cancel can ask before it throws them away (DS-E9).
  const filled = !!(situation || amount || activity || firm !== undefined || band || control !== undefined || bother !== undefined || note.trim());
  const cancel = () => {
    const done = () => {
      reset();
      onDone?.('cancelled');
    };
    if (!filled) return done();
    Alert.alert(EVENTS.discardTitle, EVENTS.discardBody, [
      { text: COMMON.cancel, style: 'cancel' },
      { text: EVENTS.discard, style: 'destructive', onPress: done },
    ]);
  };
  const write = async () => {
    // EVT-010, DATA-090: the picked day and part of the day, or the exact time now (period null).
    const t = savedTime(day, when, new Date());
    const base = {
      occurred_at: t.at.toISOString(),
      local_date: t.localDate,
      tz_offset_min: tzOffsetMin(t.at),
      entered_at: nowIso(),
      occurred_period: t.period,
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
    // EVT-033 (round 2): free text only, stored as kind `other`, on the picked day.
    if (kind === 'context' && note.trim()) await insertContextFlag(db, { kind: 'other', from_date: day, to_date: null, note: note.trim().slice(0, EVENTS.noteMax) });
  };
  // One save per tap, and a failed save says so and keeps the answers (DS-E9).
  const save = async () => {
    if (busy || !canSave) return;
    setBusy(true);
    setFailed(false);
    try {
      await write();
      bump();
      reset();
      setSaved(true);
      onDone?.('saved');
    } catch (e) {
      console.warn(e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  // ⌘↵ (Ctrl+Enter) saves on the Mac, also from inside the note box. useHotkeys ignores keys with modifiers.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.defaultPrevented) return;
      e.preventDefault();
      void saveRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const scale = Array.from({ length: 11 }, (_, i) => ({ value: i, label: String(i) }));
  const body = (
    <>
      {failed ? <Banner tone="critical" text={ERRORS.saveFailed} /> : null}
      <TypeTiles
        options={[
          { value: 'leak', label: EVENTS.leakType },
          ...(male ? [{ value: 'sex' as const, label: EVENTS.sexType }] : []),
          { value: 'context', label: EVENTS.contextType },
        ]}
        value={kind}
        onChange={(k) => {
          setSaved(false);
          setKind(k);
        }}
      />
      {kind === 'context' ? (
        <>
          <Label>{EVENTS.whichDay}</Label>
          <DayStrip value={day} onChange={setDay} now={now} />
          <View style={{ gap: space(0.5) }}>
            <Field
              label={EVENTS.noteLabel}
              accessibilityHint={EVENTS.noteHint}
              value={note}
              onChangeText={setNote}
              maxLength={EVENTS.noteMax}
              multiline
              textAlignVertical="top"
              style={{ minHeight: 104, maxHeight: 200, paddingTop: space(1), paddingBottom: space(1) }}
            />
            <P small muted>
              {EVENTS.noteHint}
            </P>
            {note.length >= COUNT_FROM ? (
              <View accessibilityLiveRegion="polite">
                <P small muted>
                  {EVENTS.noteCount(note.length, EVENTS.noteMax)}
                </P>
              </View>
            ) : null}
          </View>
          <P small muted>
            {EVENTS.notePlace}
          </P>
        </>
      ) : kind ? (
        <>
          <Label>{kind === 'sex' ? EVENTS.whenSex : EVENTS.when}</Label>
          <DayStrip value={day} onChange={setDay} now={now} />
          <TimeOfDaySlider day={day} value={when} onChange={setWhen} now={now} />
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
          {data?.goals.includes('erection') ? (
            <>
              <H2>{EVENTS.firmness}</H2>
              <Choice label={EVENTS.firmness} options={EVENTS.firmnessOptions.map((o) => ({ value: o.value as number | null, label: o.label }))} value={firm} onChange={setFirm} />
            </>
          ) : null}
          {data?.goals.includes('ejaculatory_control') ? (
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
      {/* M8: LOG-003 keeps the label visible, but at the bottom so it does not lead the form. */}
      {kind && kind !== 'context' ? (
        <P small muted>
          {APP_QUESTION_LABEL}
        </P>
      ) : null}
    </>
  );
  const web = Platform.OS === 'web';
  const inlineActions = kind ? (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: space(1) }}>
      {web ? (
        <P small muted>
          {EVENTS.saveKey}
        </P>
      ) : null}
      <Button label={COMMON.cancel} kind="quiet" onPress={cancel} />
      <Button label={COMMON.save} onPress={save} busy={busy} disabled={!canSave} />
    </View>
  ) : null;
  const footer = kind ? (
    <>
      <Button label={COMMON.save} onPress={save} busy={busy} disabled={!canSave} />
      <Button label={COMMON.cancel} kind="quiet" onPress={cancel} />
    </>
  ) : null;
  return { ready: !!data, kind, body, inlineActions, footer, saved: saved && !kind };
}

/** The log form with Save at its end. For the quick-log panel (L on the Mac) and the desktop Log page. */
export function LogForm(props: LogFormProps) {
  const f = useLogForm(props);
  return (
    <View style={{ gap: space(2) }}>
      {f.saved ? <Banner tone="success" text={EVENTS.saved} /> : null}
      {f.body}
      {f.inlineActions}
    </View>
  );
}
