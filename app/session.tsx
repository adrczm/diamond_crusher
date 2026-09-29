// Guided session (spec 03): timed phases, cues, Getting weak, Pain, pause on background, then the 15-second log (06a).
// From Today's Start (go=1) it runs at once; the 30 s relax is the lead-in (M6). Other ways in keep the ready screen,
// because on the web the Start tap there is the gesture that allows sound.
import { useKeepAwake } from 'expo-keep-awake';
import { usePreventRemove } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Platform, View } from 'react-native';
import { Text } from '../src/ui/text';
import { BLOCK_NAME, INTENSITY, PHASE_TEXT, RELAX_STEP_TEXT, SESSION, VOICE, voiceBlock } from '../src/content/en/exercise';
import { REMINDER_CUES, cueText } from '../src/content/en/learn';
import { PAIN_CHOICE, RELAX_ONLY_HOME } from '../src/content/en/screening';
import { APP_QUESTION_LABEL, SESSION_LOG } from '../src/content/en/items';
import { COMMON, DESKTOP, HOME, MILESTONES, NEXT_NAME } from '../src/content/en/strings';
import { getProfile } from '../src/data/repositories/profile';
import { getHabitDay, saveSessionLog, setHabitDay } from '../src/data/repositories/sessions';
import { getSettings } from '../src/data/repositories/settings';
import { formatDuration, toLocalDate } from '../src/domain/dates';
import { reminderCueIndex } from '../src/domain/learn';
import { SessionRunner, type RunnerEvent } from '../src/domain/session/engine';
import { relaxPlan, type SessionPlan, type TimelinePhase } from '../src/domain/session/plan';
import type { Completion, OffTick, Pain3 } from '../src/domain/types';
import { holdLockForRun, setSessionScreenOpen, useApp, useLoad } from '../src/features/app';
import { leaveFlow } from '../src/features/screens/GuidedFlow';
import { loadSessionSummary } from '../src/features/homeService';
import { SessionContents } from '../src/features/screens/SessionContents';
import { WeekStrip, whenText } from '../src/features/screens/WeekStrip';
import { reconcileReminders } from '../src/features/reminderService';
import { reportPain } from '../src/features/safetyService';
import { planToday, saveSession, type SaveSessionResult } from '../src/features/trainingService';
import { feedback } from '../src/platform/feedback';
import { Banner, Button, Card, H1, H2, Label, Loading, MultiChoice, P, Row, Screen, Segments, ToggleRow } from '../src/ui/kit';
import { useHotkeys } from '../src/ui/hotkeys';
import { isWeb, useDesktop } from '../src/ui/layout';
import { useReducedMotion } from '../src/ui/motion';
import { Celebrate, Ring } from '../src/ui/ring';
import { useColors } from '../src/ui/theme';

const mono = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

type Stage = 'ready' | 'running' | 'painAsk' | 'log' | 'done';

export default function SessionScreen() {
  const params = useLocalSearchParams<{ relax?: string; extra?: string; go?: string }>();
  const { db, bump } = useApp();
  const { data, reload: loadRetry, error: loadError } = useLoad(async (d) => ({ today: await planToday(d), settings: await getSettings(d), profile: await getProfile(d) }), []);
  const [stage, setStage] = useState<Stage>('ready');
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [extra, setExtra] = useState(false);
  const [saved, setSaved] = useState<SaveSessionResult | null>(null);
  const [completion, setCompletion] = useState<Completion>('complete');
  const [saveError, setSaveError] = useState(false);
  const pending = useRef<Parameters<typeof saveSession>[1] | null>(null);
  const saving = useRef(false);
  const runner = useRef<SessionRunner | null>(null);
  const startedAt = useRef<Date>(new Date());
  // One session screen at a time (DS-E8).
  useEffect(() => {
    setSessionScreenOpen(true);
    return () => setSessionScreenOpen(false);
  }, []);

  useEffect(() => {
    if (!data || plan) return;
    const t = data.today;
    if (params.relax === '1' || t.kind === 'relax') setPlan(relaxPlan('lying'));
    else if (params.extra === '1' && t.extraPlan && t.extraAllowed) {
      setPlan(t.extraPlan);
      setExtra(true);
    } else if (t.kind === 'strength' && t.plan) setPlan(t.plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const begin = useCallback(async (p: SessionPlan) => {
    await feedback.prepare().catch(() => undefined);
    runner.current = new SessionRunner(p);
    startedAt.current = new Date();
    setStage('running');
    // A reload on the Mac then opens the ready screen, whose Start tap lets the browser play sound (DS-E10).
    router.setParams({ go: undefined });
  }, []);
  // Today's Start already prepared the sound in its tap, so a strength session starts straight away.
  useEffect(() => {
    if (plan && stage === 'ready' && params.go === '1' && plan.templateKey === 'strength' && !extra) void begin(plan);
  }, [plan, stage, params.go, extra, begin]);

  if (!data) return <Loading error={loadError} onRetry={loadRetry} />;
  const t = data.today;
  if (!plan) {
    return (
      <Screen title={SESSION.start} footer={<Button label={COMMON.back} onPress={leaveFlow} />}>
        <P>{t.kind === 'day_done' ? SESSION.dayDone : t.kind === 'learn' ? SESSION.learnFirst : SESSION.exercisesPaused}</P>
      </Screen>
    );
  }

  // The input is built once, so Try again saves the same session (DS-E7).
  const onFinished = async (c: Completion) => {
    const r = runner.current;
    if (!r) return;
    feedback.stop();
    setCompletion(c);
    pending.current = {
      plan,
      slotNo: t.slotNo,
      extra,
      startedAt: startedAt.current,
      endedAt: new Date(),
      completion: c,
      activeS: r.elapsedMs(mono()) / 1000,
      results: r.results(),
      position: plan.position,
    };
    await persist();
  };
  const persist = async () => {
    const input = pending.current;
    if (!input || saving.current) return;
    saving.current = true;
    setSaveError(false);
    try {
      const res = await saveSession(db, input);
      pending.current = null;
      setSaved(res);
      if (input.completion === 'stopped_pain') await reportPain(db, 'yes', `session:${res.id}`, toLocalDate(new Date()));
      reconcileReminders(db);
      bump();
      setStage(plan.templateKey === 'relax_only' ? 'done' : 'log');
    } catch (e) {
      console.warn(e);
      setSaveError(true);
    } finally {
      saving.current = false;
    }
  };

  if (saveError) {
    return (
      <Screen title={SESSION.start} headerShown={false} width="narrow" footer={<Button label={COMMON.tryAgain} onPress={() => void persist()} />}>
        <View style={{ paddingTop: 48 }}>
          <Banner tone="critical" text={SESSION.saveFailed} />
        </View>
      </Screen>
    );
  }

  if (stage === 'ready') {
    if (params.go === '1' && plan.templateKey === 'strength' && !extra) return <Loading />;
    const start = () => begin(plan);
    return (
      <Screen
        title={plan.templateKey === 'relax_only' ? SESSION.relaxPractice : SESSION.start}
        width="narrow"
        footer={<Button label={SESSION.start} onPress={start} />}
      >
        <Keys map={{ Enter: () => void start() }} />
        <Card>
          <SessionContents plan={plan} />
        </Card>
        {extra ? <Banner tone="soft" text={SESSION.extraNote} /> : null}
      </Screen>
    );
  }

  if (stage === 'running' || stage === 'painAsk') {
    return (
      <Runner
        runner={runner.current as SessionRunner}
        audio={data.settings.audio_mode}
        vibration={data.settings.vibration}
        cue={cueText(data.profile?.preferred_cue_key ?? null, data.profile?.anatomy ?? 'other_unspecified')}
        painAsk={stage === 'painAsk'}
        onPain={() => setStage('painAsk')}
        onPainAnswer={() => setStage('running')}
        onFinished={onFinished}
      />
    );
  }

  if (stage === 'log' && saved) return <SessionLog sessionId={saved.id} completion={completion} onDone={() => setStage('done')} />;

  return <Done completion={completion} saved={saved} extra={extra} strength={plan.templateKey === 'strength'} />;
}

/** H2: a calm summary (today, the week, progress, next session). No confetti and no sound; the tick respects reduced motion. */
function Done({ completion, saved, extra, strength }: { completion: Completion; saved: SaveSessionResult | null; extra: boolean; strength: boolean }) {
  const { data: s } = useLoad((d) => loadSessionSummary(d), []);
  const close = () => router.replace('/');
  const next = (() => {
    if (!s || !strength || completion === 'stopped_pain') return null;
    if (s.nextReminder) return SESSION.nextSession(whenText(s.nextReminder));
    return s.dayDone ? SESSION.nextTomorrow : SESSION.nextLaterToday;
  })();
  const progress = (() => {
    if (!s || !strength || s.levelMax == null) return null;
    const lvl = SESSION.levelLine(s.level, s.levelMax);
    if (!s.next || s.next === 'top') return lvl;
    return `${lvl} · ${s.weeksToNext != null ? HOME.nextAfter(NEXT_NAME[s.next], s.weeksToNext) : HOME.next(NEXT_NAME[s.next])}`;
  })();
  return (
    <Screen title={SESSION.complete} headerShown={false} width="narrow" footer={<Button label={COMMON.done} onPress={close} />}>
      <Keys map={{ Enter: close, Escape: close }} />
      <View style={{ paddingTop: 32, gap: 16 }}>
        <View style={{ alignItems: 'center', gap: 16 }}>
          {completion === 'complete' ? <Celebrate size={88} /> : null}
          <H1>{completion === 'complete' ? SESSION.complete : SESSION.partial}</H1>
        </View>
        {completion === 'stopped_pain' ? <P>{RELAX_ONLY_HOME}</P> : null}
        {s && strength ? (
          <Card>
            {extra ? <P>{SESSION.extraNote}</P> : s.slotsTotal > 0 ? <H2>{SESSION.todayCount(s.slotsDone, s.slotsTotal)}</H2> : null}
            <WeekStrip week={s.week} target={s.weekTarget} />
            {progress ? <P muted>{progress}</P> : null}
            {next ? <P muted>{next}</P> : null}
          </Card>
        ) : null}
        {saved?.milestones.map((m) => (
          <Card key={m} tone="soft">
            <P>{MILESTONES[m] ?? ''}</P>
          </Card>
        ))}
        {saved?.changes.length ? <P muted>{SESSION.stepUp}</P> : null}
      </View>
    </Screen>
  );
}

function phaseTitle(p: TimelinePhase | null): string {
  if (!p) return '';
  if (p.kind === 'relax') return RELAX_STEP_TEXT[p.relaxStep ?? 'relax_in'].title;
  if (p.kind === 'transition') return PHASE_TEXT.transition;
  return PHASE_TEXT[p.kind];
}

function repLabel(p: TimelinePhase | null): string {
  if (!p || p.rep === 0) return '';
  if (p.block === 'hold') return SESSION.holdLabel(p.rep, p.reps);
  if (p.block === 'flick') return SESSION.flickLabel(p.rep, p.reps);
  if (p.block === 'endurance') return SESSION.enduranceLabel(p.rep, p.reps);
  return SESSION.repCount(p.rep, p.reps);
}

function Runner({
  runner,
  audio,
  vibration,
  cue,
  painAsk,
  onPain,
  onPainAnswer,
  onFinished,
}: {
  runner: SessionRunner;
  audio: 'off' | 'tones' | 'voice';
  vibration: boolean;
  cue: string;
  painAsk: boolean;
  onPain: () => void;
  onPainAnswer: () => void;
  onFinished: (c: Completion) => void;
}) {
  useKeepAwake();
  const c = useColors();
  const desktop = useDesktop();
  const reduced = useReducedMotion();
  // A short call or a press of the power button does not lock the app and throw the session away (DS-E1).
  useEffect(() => holdLockForRun(), []);
  const [, setTick] = useState(0);
  const [note, setNoteText] = useState<string | null>(null);
  // A note belongs to the block that is current just after it is set, and clears when the next block starts (DS-F3).
  const noteBlock = useRef<number | null>(null);
  const setNote = (t: string | null) => {
    noteBlock.current = runner.currentPhase()?.blockIndex ?? null;
    setNoteText(t);
  };
  const [confirmEnd, setConfirmEnd] = useState(false);
  const finished = useRef(false);

  const handle = useCallback(
    (events: RunnerEvent[]) => {
      for (const e of events) {
        if (e.type === 'finished') {
          if (!finished.current) {
            finished.current = true;
            void feedback.cue('done', { audio, vibration, words: VOICE.done });
            onFinished(e.completion);
          }
        } else if (e.phase.kind === 'squeeze') {
          void feedback.cue('squeeze', { audio, vibration, words: VOICE.squeeze });
        } else if (e.phase.kind === 'release') {
          void feedback.cue('release', { audio, vibration, words: VOICE.release });
        } else if (e.phase.kind === 'transition' && audio === 'voice') {
          // Voice names the next block, so the person knows what comes without looking (decision 4).
          void feedback.cue('tick', { audio, vibration, words: voiceBlock(e.phase.block) });
        } else if (e.phase.kind === 'transition' || (e.phase.kind === 'relax' && e.phase.rep <= 1)) {
          void feedback.cue('tick', { audio: audio === 'voice' ? 'off' : audio, vibration });
        }
      }
    },
    [audio, vibration, onFinished]
  );

  useEffect(() => {
    if (runner.getState() === 'ready') handle(runner.start(mono()));
    const id = setInterval(() => {
      handle(runner.tick(mono()));
      setTick((x) => x + 1);
    }, 200);
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') runner.pause(mono());
    });
    return () => {
      clearInterval(id);
      sub.remove();
      feedback.stop();
    };
  }, [runner, handle]);

  const now = mono();
  const p = runner.currentPhase();
  const state = runner.getState();
  const left = Math.ceil(runner.phaseRemainingS(now));
  const squeezing = p?.kind === 'squeeze';
  const inRelaxOut = p?.relaxStep === 'relax_out';
  const canWeak = state === 'running' && (p?.block === 'hold' || p?.block === 'flick') && p.kind !== 'transition';
  const reminder = p && p.rep > 0 && p.kind === 'squeeze' ? (p.rep === 1 && p.block === 'hold' ? cue : REMINDER_CUES[reminderCueIndex(p.rep, REMINDER_CUES.length)]) : null;
  const totalLeft = Math.max(0, runner.totalS() - runner.elapsedMs(now) / 1000);
  const done = runner.totalS() > 0 ? 1 - totalLeft / runner.totalS() : 0;
  const togglePause = () => {
    setConfirmEnd(false);
    if (state === 'paused') runner.resume(mono());
    else runner.pause(mono());
  };
  // H3: End session (tap or Esc) pauses first and asks; a second Esc or "End session" ends.
  // A stray tap or key never throws a session away.
  const askEnd = () => {
    if (state !== 'paused') runner.pause(mono());
    setConfirmEnd(true);
  };
  const endNow = () => handle(runner.stopEarly(mono(), 'user_stop'));
  const keepGoing = () => {
    setConfirmEnd(false);
    if (runner.getState() === 'paused') runner.resume(mono());
  };
  const stop = () => {
    if (inRelaxOut) handle(runner.skipRelaxOut(mono()));
    else if (confirmEnd) endNow();
    else askEnd();
  };
  useHotkeys({ ' ': togglePause, Escape: stop }, !painAsk);
  // System Back, a swipe or the toolbar Back asks "End session?" like the button (DS-W1). The browser asks before a
  // reload or a closed tab.
  const running = state === 'running' || state === 'paused';
  usePreventRemove(running, () => askEnd());
  useEffect(() => {
    if (!isWeb || !running || typeof window === 'undefined') return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running]);
  // The "Getting weak" note belongs to one block; it clears when the next block starts (DS-F3).
  const blockIndex = p?.blockIndex;
  useEffect(() => {
    if (blockIndex !== noteBlock.current) setNoteText(null);
  }, [blockIndex]);

  // The circle swells on squeeze and settles on release (a spring, so it feels like a muscle, not a switch).
  const scale = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    const to = squeezing ? 1 : 0.85;
    if (reduced) scale.setValue(to);
    else Animated.spring(scale, { toValue: to, friction: 7, tension: 60, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [squeezing, reduced, scale]);
  const D = desktop ? 280 : 200;

  if (painAsk) {
    return (
      <Screen title="" headerShown={false}>
        {/* Decision 1 (2026-09-29): the Pain button pauses and asks. Pain ends the session with the relax-out; "Just
            tired" ends only the set; "Tapped by mistake" carries on. */}
        <View style={{ paddingTop: 48, gap: 16 }}>
          <P muted>{PAIN_CHOICE.pausedNote}</P>
          <H1>{PAIN_CHOICE.question}</H1>
          <Button
            label={PAIN_CHOICE.pain}
            onPress={() => {
              handle(runner.stopEarly(mono(), 'pain'));
              onPainAnswer();
            }}
          />
          <Button
            label={PAIN_CHOICE.tired}
            kind="secondary"
            onPress={() => {
              runner.resume(mono());
              handle(runner.gettingWeak(mono()));
              setNote(PAIN_CHOICE.tiredReply);
              onPainAnswer();
            }}
          />
          <Button
            label={PAIN_CHOICE.mistake}
            kind="quiet"
            onPress={() => {
              runner.resume(mono());
              onPainAnswer();
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title=""
      headerShown={false}
      footer={
        confirmEnd ? (
          <>
            <H2>{SESSION.endQuestion}</H2>
            <P muted>{SESSION.endNote}</P>
            <Button label={SESSION.keepGoing} onPress={keepGoing} />
            <Button label={SESSION.stop} kind="secondary" onPress={endNow} />
          </>
        ) : (
          <>
            {canWeak ? (
              <Button
                label={SESSION.gettingWeak}
                kind="secondary"
                onPress={() => {
                  handle(runner.gettingWeak(mono()));
                  setNote(SESSION.gettingWeakReply);
                }}
              />
            ) : null}
            {inRelaxOut ? <Button label={SESSION.skip} kind="quiet" onPress={() => handle(runner.skipRelaxOut(mono()))} /> : null}
            <Row>
              <Button
                style={{ flex: 1 }}
                label={state === 'paused' ? SESSION.resume : SESSION.pause}
                kind="secondary"
                onPress={togglePause}
              />
              <Button
                style={{ flex: 1 }}
                label={SESSION.pain}
                kind="secondary"
                onPress={() => {
                  if (runner.getState() !== 'paused') runner.pause(mono());
                  onPain();
                }}
              />
            </Row>
            {!inRelaxOut ? <Button label={SESSION.stop} kind="quiet" onPress={askEnd} /> : null}
          </>
        )
      }
    >
      <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <Label>{p ? (p.block === 'relax' ? BLOCK_NAME.relax : BLOCK_NAME[p.block]) : ''}</Label>
        <Text
          style={{ fontSize: 36, fontWeight: '700', color: squeezing ? c.squeeze : c.text, textAlign: 'center' }}
          accessibilityLiveRegion="polite"
          maxFontSizeMultiplier={1.4}
        >
          {state === 'paused' ? SESSION.paused : phaseTitle(p)}
        </Text>
        <Ring value={done} size={D + 40} stroke={4} color={c.muted} track={c.border} label={DESKTOP.sessionProgress(Math.round(done * 100))}>
          <Animated.View
            style={{
              width: D,
              height: D,
              borderRadius: D / 2,
              backgroundColor: squeezing ? c.squeeze : c.soft,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale }],
            }}
          >
            <Text style={{ fontSize: desktop ? 88 : 64, fontWeight: '700', color: squeezing ? c.onSqueeze : c.primary }} maxFontSizeMultiplier={1.3}>
              {left}
            </Text>
          </Animated.View>
        </Ring>
        <H2>{repLabel(p)}</H2>
        {p?.kind === 'relax' ? <P center>{RELAX_STEP_TEXT[p.relaxStep ?? 'relax_in'].body}</P> : null}
        {p && p.kind === 'squeeze' && p.block !== 'relax' ? <P center muted>{INTENSITY[p.block]}</P> : null}
        {reminder ? <P center>{reminder}</P> : null}
        {note ? <P center muted>{note}</P> : null}
        <P small muted center>
          {SESSION.timeLeft(formatDuration(Math.round(totalLeft)))}
        </P>
        {/* The key hint shows only while paused, so nothing extra moves during reps (DS-F3). */}
        {desktop && isWeb && state === 'paused' ? (
          <P small muted center>
            {DESKTOP.sessionKeys}
          </P>
        ) : null}
      </View>
    </Screen>
  );
}

function SessionLog({ sessionId, completion, onDone }: { sessionId: string; completion: Completion; onDone: () => void }) {
  const { db, bump } = useApp();
  const [feel, setFeel] = useState<number | undefined>();
  const [pain, setPain] = useState<Pain3 | undefined>(completion === 'stopped_pain' ? 'yes' : undefined);
  const [offOpen, setOffOpen] = useState(false);
  const [off, setOff] = useState<OffTick[]>([]);
  const [habit, setHabit] = useState<boolean | undefined>();
  const [askHabit, setAskHabit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aLittle, setALittle] = useState(false);
  const today = toLocalDate(new Date());
  useEffect(() => {
    getHabitDay(db, today)
      .then((v) => setAskHabit(v === null))
      .catch(() => undefined);
  }, [db, today]);
  const save = async () => {
    setBusy(true);
    try {
      await saveSessionLog(db, { session_id: sessionId, feel: feel ?? null, pain: pain ?? null, off_ticks: offOpen ? off : null, item_set_version: 1 });
      if (askHabit && habit !== undefined) await setHabitDay(db, today, habit);
      if (pain && pain !== 'no' && completion !== 'stopped_pain') {
        const relax = await reportPain(db, pain, `session:${sessionId}`, today);
        if (!relax && pain === 'a_little') {
          setALittle(true);
          bump();
          return;
        }
      }
      bump();
      onDone();
    } finally {
      setBusy(false);
    }
  };
  if (aLittle) {
    return (
      <Screen title={SESSION_LOG.saved} footer={<Button label={COMMON.continue} onPress={onDone} />}>
        <P>{PAIN_CHOICE.aLittle}</P>
      </Screen>
    );
  }
  return (
    <Screen
      title={SESSION.logTitle}
      width="narrow"
      footer={
        <>
          <Button label={COMMON.save} onPress={save} busy={busy} />
          <Button label={COMMON.skip} kind="quiet" onPress={onDone} disabled={busy} />
        </>
      }
    >
      <H2>{SESSION_LOG.feelQuestion}</H2>
      <Segments options={SESSION_LOG.feelOptions.map((o) => ({ value: o.value as number, label: o.label }))} value={feel} onChange={setFeel} />
      <H2>{SESSION_LOG.painQuestion}</H2>
      <Segments options={SESSION_LOG.painOptions.map((o) => ({ value: o.value as Pain3, label: o.label }))} value={pain} onChange={setPain} />
      <ToggleRow label={SESSION_LOG.offToggle} value={offOpen} onChange={setOffOpen} />
      {offOpen ? (
        <>
          <P muted>{SESSION_LOG.offQuestion}</P>
          <MultiChoice options={SESSION_LOG.offOptions.map((o) => ({ value: o.value as OffTick, label: o.label }))} values={off} onChange={setOff} />
          {off.some((o) => o === 'pushed_down' || o === 'could_not_release' || o === 'leak_during_exercise') ? (
            <Card tone="soft" onPress={() => router.push('/learn?mode=recheck')}>
              <P>{SESSION_LOG.learnLink}</P>
            </Card>
          ) : null}
        </>
      ) : null}
      {askHabit ? (
        <>
          <H2>{SESSION_LOG.habitQuestion}</H2>
          <Segments
            options={[
              { value: true, label: COMMON.yes },
              { value: false, label: COMMON.no },
            ]}
            value={habit}
            onChange={setHabit}
          />
        </>
      ) : null}
      {/* M8: LOG-003 keeps the label visible, but at the bottom so it does not lead the form. */}
      <P small muted>
        {APP_QUESTION_LABEL}
      </P>
    </Screen>
  );
}

/** Keyboard shortcuts for one stage of the session (web only). */
function Keys({ map }: { map: Record<string, () => void> }) {
  useHotkeys(map);
  return null;
}
