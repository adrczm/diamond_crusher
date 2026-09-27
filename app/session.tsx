// Guided session (spec 03): timed phases, cues, Getting weak, Pain, pause on background, then the 15-second log (06a).
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { BLOCK_NAME, INTENSITY, PHASE_TEXT, RELAX_STEP_TEXT, SESSION, VOICE } from '../src/content/en/exercise';
import { REMINDER_CUES, cueText } from '../src/content/en/learn';
import { PAIN_CHOICE, RELAX_ONLY_HOME } from '../src/content/en/screening';
import { APP_QUESTION_LABEL, SESSION_LOG } from '../src/content/en/items';
import { COMMON, MILESTONES } from '../src/content/en/strings';
import { getProfile } from '../src/data/repositories/profile';
import { getHabitDay, saveSessionLog, setHabitDay } from '../src/data/repositories/sessions';
import { getSettings } from '../src/data/repositories/settings';
import { formatDuration, toLocalDate } from '../src/domain/dates';
import { reminderCueIndex } from '../src/domain/learn';
import { SessionRunner, type RunnerEvent } from '../src/domain/session/engine';
import { durationS, relaxPlan, type SessionPlan, type TimelinePhase } from '../src/domain/session/plan';
import type { Completion, OffTick, Pain3 } from '../src/domain/types';
import { useApp, useLoad } from '../src/features/app';
import { reconcileReminders } from '../src/features/reminderService';
import { reportPain } from '../src/features/safetyService';
import { planToday, saveSession, type SaveSessionResult } from '../src/features/trainingService';
import { feedback } from '../src/platform/feedback';
import { Banner, Button, Card, H1, H2, Label, Loading, MultiChoice, P, Row, Screen, Segments, ToggleRow } from '../src/ui/kit';
import { useColors } from '../src/ui/theme';

const mono = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

type Stage = 'ready' | 'running' | 'painAsk' | 'log' | 'done';

export default function SessionScreen() {
  const params = useLocalSearchParams<{ relax?: string; extra?: string }>();
  const { db, bump } = useApp();
  const { data } = useLoad(async (d) => ({ today: await planToday(d), settings: await getSettings(d), profile: await getProfile(d) }), []);
  const [stage, setStage] = useState<Stage>('ready');
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [extra, setExtra] = useState(false);
  const [saved, setSaved] = useState<SaveSessionResult | null>(null);
  const [completion, setCompletion] = useState<Completion>('complete');
  const runner = useRef<SessionRunner | null>(null);
  const startedAt = useRef<Date>(new Date());

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

  if (!data) return <Loading />;
  const t = data.today;
  if (!plan) {
    return (
      <Screen title={SESSION.start} footer={<Button label={COMMON.back} onPress={() => router.back()} />}>
        <P>{t.kind === 'day_done' ? SESSION.dayDone : t.kind === 'learn' ? 'Learn the squeeze first. It unlocks your sessions.' : 'Exercises are paused.'}</P>
      </Screen>
    );
  }

  const onFinished = async (c: Completion) => {
    const r = runner.current;
    if (!r) return;
    feedback.stop();
    setCompletion(c);
    const res = await saveSession(db, {
      plan,
      slotNo: t.slotNo,
      extra,
      startedAt: startedAt.current,
      endedAt: new Date(),
      completion: c,
      activeS: r.elapsedMs(mono()) / 1000,
      results: r.results(),
      position: plan.position,
    });
    setSaved(res);
    if (c === 'stopped_pain') await reportPain(db, 'yes', `session:${res.id}`, toLocalDate(new Date()));
    reconcileReminders(db);
    bump();
    setStage(plan.templateKey === 'relax_only' ? 'done' : 'log');
  };

  if (stage === 'ready') {
    const est = durationS(plan);
    return (
      <Screen
        title={plan.templateKey === 'relax_only' ? SESSION.relaxPractice : SESSION.start}
        footer={
          <Button
            label={SESSION.start}
            onPress={async () => {
              await feedback.prepare().catch(() => undefined);
              runner.current = new SessionRunner(plan);
              startedAt.current = new Date();
              setStage('running');
            }}
          />
        }
      >
        <H1>{plan.templateKey === 'relax_only' ? SESSION.relaxPractice : SESSION.positionName[plan.position]}</H1>
        <P>{SESSION.positionHint[plan.position]}</P>
        <P muted>{`${SESSION.estimated} ${formatDuration(est)}`}</P>
        {plan.templateKey === 'strength' ? (
          <Card>
            <P>{`${BLOCK_NAME.hold}: ${plan.load.N} × ${plan.load.H} s`}</P>
            <P>{`${BLOCK_NAME.flick}: ${plan.load.F}`}</P>
            {plan.load.E ? <P>{`${BLOCK_NAME.endurance}: ${plan.load.enduranceReps} × ${plan.load.E} s`}</P> : null}
          </Card>
        ) : null}
        {extra ? <Banner tone="soft" text="Extra session. It doesn't count toward today's plan." /> : null}
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
        onPainAnswer={(isPain) => {
          if (isPain) runner.current?.markPain();
          setStage('running');
        }}
        onFinished={onFinished}
      />
    );
  }

  if (stage === 'log' && saved) return <SessionLog sessionId={saved.id} completion={completion} onDone={() => setStage('done')} />;

  return (
    <Screen title={SESSION.complete} headerShown={false} footer={<Button label={COMMON.done} onPress={() => router.replace('/')} />}>
      <View style={{ paddingTop: 32, gap: 16 }}>
        <H1>{completion === 'complete' ? SESSION.complete : SESSION.partial}</H1>
        {completion === 'stopped_pain' ? <P>{RELAX_ONLY_HOME}</P> : null}
        {saved?.milestones.map((m) => (
          <Card key={m} tone="soft">
            <P>{MILESTONES[m] ?? ''}</P>
          </Card>
        ))}
        {saved?.changes.length ? <P muted>Your plan has stepped up for next week.</P> : null}
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
  return `${p.rep} of ${p.reps}`;
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
  onPainAnswer: (pain: boolean) => void;
  onFinished: (c: Completion) => void;
}) {
  useKeepAwake();
  const c = useColors();
  const [, setTick] = useState(0);
  const [note, setNote] = useState<string | null>(null);
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

  if (painAsk) {
    return (
      <Screen title="" headerShown={false}>
        <View style={{ paddingTop: 48, gap: 16 }}>
          <H1>{PAIN_CHOICE.question}</H1>
          <Button label={PAIN_CHOICE.pain} onPress={() => onPainAnswer(true)} />
          <Button
            label={PAIN_CHOICE.tired}
            kind="secondary"
            onPress={() => {
              setNote(PAIN_CHOICE.tiredReply);
              onPainAnswer(false);
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
      scroll={false}
      footer={
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
              onPress={() => (state === 'paused' ? runner.resume(mono()) : runner.pause(mono()))}
            />
            <Button
              style={{ flex: 1 }}
              label={SESSION.pain}
              kind="secondary"
              onPress={() => {
                handle(runner.stopEarly(mono(), 'user_stop'));
                onPain();
              }}
            />
          </Row>
          {!inRelaxOut ? <Button label={SESSION.stop} kind="quiet" onPress={() => handle(runner.stopEarly(mono(), 'user_stop'))} /> : null}
        </>
      }
    >
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <Label>{p ? (p.block === 'relax' ? BLOCK_NAME.relax : BLOCK_NAME[p.block]) : ''}</Label>
        <Text style={{ fontSize: 36, fontWeight: '700', color: squeezing ? c.squeeze : c.text, textAlign: 'center' }} accessibilityLiveRegion="polite">
          {state === 'paused' ? SESSION.paused : phaseTitle(p)}
        </Text>
        <View
          style={{
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: squeezing ? c.squeeze : c.soft,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: squeezing ? 1 : 0.85 }],
          }}
        >
          <Text style={{ fontSize: 64, fontWeight: '700', color: squeezing ? c.onPrimary : c.primary }}>{left}</Text>
        </View>
        <H2>{repLabel(p)}</H2>
        {p?.kind === 'relax' ? <P center>{RELAX_STEP_TEXT[p.relaxStep ?? 'relax_in'].body}</P> : null}
        {p && p.kind === 'squeeze' && p.block !== 'relax' ? <P center muted>{INTENSITY[p.block]}</P> : null}
        {reminder ? <P center>{reminder}</P> : null}
        {note ? <P center muted>{note}</P> : null}
        <P small muted center>{`${formatDuration(Math.round(totalLeft))} left`}</P>
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
      title="How did it go?"
      footer={
        <>
          <Button label={COMMON.save} onPress={save} busy={busy} />
          <Button label={COMMON.skip} kind="quiet" onPress={onDone} disabled={busy} />
        </>
      }
    >
      <P small muted>
        {APP_QUESTION_LABEL}
      </P>
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
    </Screen>
  );
}
