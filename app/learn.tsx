// Learn the squeeze (spec 02): 3 to 5 guided attempts with a self-check and a mistakes checklist.
// UX audit H6: lying fingertip check by default, a separate standing mirror check, a diagram, the lift circle, and a
// short checklist after the first attempt. H8: Close on phones, Space or Enter on desktop. M9: stop test is info only.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../src/ui/text';
import { EDUCATION } from '../src/content/en/education';
import {
  CUES,
  FEMALE_MIRROR_ANSWERS,
  INSIDE_ANSWERS,
  INSIDE_CHECK,
  LEAK_QUESTION,
  LEARN,
  LIFT_ANSWERS,
  LIFT_QUESTION,
  MIRROR_ANSWERS,
  MIRROR_CHECK,
  MISTAKES,
  STOP_TEST,
  TOUCH_ANSWERS,
  TOUCH_CHECK,
  cueKeysFor,
  cueText,
} from '../src/content/en/learn';
import { CAUTION_CARD } from '../src/content/en/screening';
import { COMMON } from '../src/content/en/strings';
import { markContentSeen, seenContent } from '../src/data/repositories/misc';
import { getProfile } from '../src/data/repositories/profile';
import { getProgramme } from '../src/data/repositories/programme';
import { getSafetyState } from '../src/data/repositories/safety';
import {
  classifyAttempt,
  insideCheckAllowed,
  mirrorCheckRequired,
  retryTips,
  sittingShouldEnd,
  type InsideCheck,
  type LiftAnswer,
  type MirrorCheck,
  type Mistakes,
  type ReleaseAnswer,
  type SittingResult,
  type TouchCheck,
} from '../src/domain/learn';
import { strengthAllowed } from '../src/domain/safety';
import { useApp, useLoad } from '../src/features/app';
import { profileFacts } from '../src/features/safetyService';
import { markStopTestShown, saveSitting, setPreferredCue, startAnyway, type AttemptRecord } from '../src/features/learnService';
import { reconcileReminders } from '../src/features/reminderService';
import { confirmLeave, FlowScreen, leaveFlow } from '../src/features/screens/GuidedFlow';
import { LiftCircle, PelvicFloorDiagram } from '../src/features/screens/LearnVisuals';
import { Banner, Button, Card, Choice, H1, H2, Label, Loading, P, Screen, Segments } from '../src/ui/kit';
import { useColors } from '../src/ui/theme';
import { VOICE } from '../src/content/en/exercise';
import { useKeepAwake } from 'expo-keep-awake';
import { feedback } from '../src/platform/feedback';
import { getSettings } from '../src/data/repositories/settings';
import { useCountdown } from '../src/ui/useCountdown';

type Step = 'edu' | 'intro' | 'relax' | 'cue' | 'squeeze' | 'check' | 'letgo' | 'mistakes' | 'result' | 'whichCue' | 'stopTest';

const EMPTY_MISTAKES: Mistakes = { breathing: null, buttocks: null, thighs: null, tummy: null, lift: null, leak: null };
/** "Anything feel off?" answered No: every checklist item as a good answer. */
const NOTHING_OFF: Mistakes = { breathing: true, buttocks: true, thighs: true, tummy: true, lift: 'lift', leak: false };

function BigCount({ seconds, label, onDone }: { seconds: number; label: string; onDone: () => void }) {
  const c = useColors();
  const left = useCountdown(seconds, true, onDone);
  // The screen stays on during a timed step (DS-E12).
  useKeepAwake();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
      <Text style={{ fontSize: 20, color: c.muted }} accessibilityLiveRegion="polite">
        {label}
      </Text>
      <Text style={{ fontSize: 72, fontWeight: '700', color: c.primary }} maxFontSizeMultiplier={1.3}>
        {left}
      </Text>
    </View>
  );
}

export default function Learn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const recheck = params.mode === 'recheck';
  const { db, bump } = useApp();
  const { data, reload: loadRetry, error: loadError } = useLoad(async (d) => ({
    settings: await getSettings(d),
    profile: await getProfile(d),
    prog: await getProgramme(d),
    safety: await getSafetyState(d),
    seen: await seenContent(d),
    facts: await profileFacts(d),
  }));
  const [step, setStep] = useState<Step | null>(null);
  const [eduIndex, setEduIndex] = useState(0);
  const [cueIdx, setCueIdx] = useState(0);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [startedAt, setStartedAt] = useState('');
  // The fingertip check is done lying down, like the rest of the attempt; the mirror check is an optional standing one.
  const [method, setMethod] = useState<'mirror' | 'touch'>('touch');
  const [mirror, setMirror] = useState<MirrorCheck>('not_done');
  const [touch, setTouch] = useState<TouchCheck>('not_done');
  const [inside, setInside] = useState<InsideCheck>('not_done');
  // Female: extra checks under the required mirror check, opened on request.
  const [extra, setExtra] = useState<{ touch: boolean; inside: boolean }>({ touch: false, inside: false });
  const [release, setRelease] = useState<ReleaseAnswer | undefined>();
  const [releaseAsked, setReleaseAsked] = useState(false);
  const [mistakes, setMistakes] = useState<Mistakes>(EMPTY_MISTAKES);
  const [off, setOff] = useState<boolean | undefined>();
  const [result, setResult] = useState<{ result: SittingResult; canStartAnyway: boolean; raisedQG5: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // Learn uses the same sound and vibration as a session, so it can be done lying down without watching (DS-F2).
  useEffect(() => {
    if (!data) return;
    const opts = { audio: data.settings.audio_mode, vibration: data.settings.vibration };
    if (step === 'squeeze') void feedback.cue('squeeze', { ...opts, words: VOICE.squeeze });
    else if (step === 'letgo') void feedback.cue('release', { ...opts, words: VOICE.release });
    else if (step === 'relax') void feedback.cue('tick', { ...opts, audio: opts.audio === 'voice' ? 'off' : opts.audio });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const eduScreens = EDUCATION.filter((e) => e.id === 'ED-01' || e.id === 'ED-06');

  useEffect(() => {
    if (!data || step) return;
    const needEdu = !recheck && eduScreens.some((e) => !data.seen.has(e.id));
    setStep(needEdu ? 'edu' : 'intro');
    const keys = cueKeysFor(data.profile?.anatomy ?? 'other_unspecified', data.facts);
    const pref = data.profile?.preferred_cue_key ? keys.indexOf(data.profile.preferred_cue_key) : -1;
    if (pref >= 0) setCueIdx(pref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data || !step) return <Loading error={loadError} onRetry={loadRetry} />;
  const anatomy = data.profile?.anatomy ?? 'other_unspecified';
  const cues = CUES[anatomy];
  const cueKeys = cueKeysFor(anatomy, data.facts);
  const cueKey = cueKeys[cueIdx % cueKeys.length];
  const touchCheck = TOUCH_CHECK[anatomy];
  // Female (SX-C.8): the lying mirror check is required; fingertips and the inside check are extra.
  const female = mirrorCheckRequired(anatomy);
  const showInside = insideCheckAllowed(anatomy, data.facts);
  const pregnant = data.facts.pregnant;
  const useTouch = !female && !!touchCheck && method === 'touch';
  const allowed = strengthAllowed(data.safety.mode);

  if (!allowed) {
    return (
      <Screen title={LEARN.title}>
        <Banner text={LEARN.notAvailable} />
        <Button label={COMMON.back} onPress={() => leaveFlow()} />
      </Screen>
    );
  }

  const newAttempt = () => {
    setStartedAt(new Date().toISOString());
    setMirror('not_done');
    setTouch('not_done');
    setInside('not_done');
    setRelease(undefined);
    setReleaseAsked(false);
    setMistakes(EMPTY_MISTAKES);
    setOff(undefined);
    setStep('relax');
  };

  const finishAttempt = async (m: Mistakes) => {
    // LRN-020: the standing mirror check makes this a standing attempt.
    // Female: the mirror check is lying propped, so the attempt stays lying.
    const standing = !female && !!touchCheck && method === 'mirror' && mirror !== 'not_done';
    const rec: AttemptRecord = {
      startedAt,
      cueKey,
      anatomy,
      checkMirror: mirror,
      checkTouch: touch,
      checkInside: female ? inside : undefined,
      feltRelease: release ?? 'unsure',
      mistakes: m,
      position: standing ? 'standing' : 'lying',
    };
    const next = [...attempts, rec];
    setAttempts(next);
    const end = recheck ? true : sittingShouldEnd(next.map(classifyAttempt));
    if (!end) return newAttempt();
    setBusy(true);
    try {
      const r = await saveSitting(db, next, recheck ? 'recheck' : 'sitting', 'lying');
      setResult(r);
      bump();
      reconcileReminders(db);
      setStep('result');
    } finally {
      setBusy(false);
    }
  };

  const title = recheck ? LEARN.recheckTitle : LEARN.title;
  const attemptLabel = recheck ? '' : LEARN.attemptOf(attempts.length + 1);
  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;
  // The action Space or Enter runs on desktop (H8): Ready or Continue, only while it is enabled.
  let hot: (() => void) | null = null;

  switch (step) {
    case 'edu': {
      const e = eduScreens[eduIndex];
      const next = async () => {
        await markContentSeen(db, e.id);
        if (eduIndex + 1 < eduScreens.length) setEduIndex(eduIndex + 1);
        else setStep('intro');
      };
      body = (
        <>
          <H1>{e.title}</H1>
          {e.diagram ? <PelvicFloorDiagram /> : null}
          {e.body.map((b, i) => (
            <P key={i}>{b}</P>
          ))}
        </>
      );
      footer = <Button label={COMMON.next} onPress={next} />;
      hot = next;
      break;
    }
    case 'intro':
      body = (
        <>
          <H1>{title}</H1>
          <P>{recheck ? LEARN.recheckIntro : LEARN.intro}</P>
          {!recheck ? <PelvicFloorDiagram /> : null}
          {!recheck ? <P muted>{LEARN.howItWorks}</P> : null}
        </>
      );
      footer = <Button label={COMMON.continue} onPress={newAttempt} />;
      hot = newAttempt;
      break;
    case 'relax':
      body = (
        <>
          <Label>{attemptLabel}</Label>
          <H2>{attempts.length === 0 ? (pregnant ? LEARN.relaxPregnant : LEARN.relax) : LEARN.relaxShort}</H2>
          {pregnant ? <P muted>{LEARN.pregnantDizzy}</P> : null}
          <BigCount seconds={attempts.length === 0 ? 30 : 10} label={LEARN.breatheSlowly} onDone={() => setStep('cue')} />
        </>
      );
      footer = <Button label={COMMON.skip} kind="quiet" onPress={() => setStep('cue')} />;
      break;
    case 'cue':
      body = (
        <>
          <Label>{LEARN.cueTitle}</Label>
          <H1>{cueText(cueKey, anatomy, data.facts)}</H1>
          <PelvicFloorDiagram caption={false} />
        </>
      );
      footer = (
        <>
          <Button label={LEARN.ready} onPress={() => setStep('squeeze')} />
          {cueKeys.length > 1 ? <Button label={LEARN.anotherCue} kind="quiet" onPress={() => setCueIdx(cueIdx + 1)} /> : null}
        </>
      );
      hot = () => setStep('squeeze');
      break;
    case 'squeeze':
      body = (
        <>
          <H2>{LEARN.squeeze}</H2>
          <LiftCircle squeezing seconds={3} label={cueText(cueKey, anatomy, data.facts)} onDone={() => setStep('check')} />
        </>
      );
      break;
    case 'check': {
      const answered = useTouch ? touch !== 'not_done' : mirror !== 'not_done';
      body = female ? (
        <>
          <H2>{LEARN.mirrorTitleLying}</H2>
          <P muted>{LEARN.mirrorIntroLying}</P>
          <P>{MIRROR_CHECK.female.text}</P>
          <Choice
            label={MIRROR_CHECK.female.text}
            options={FEMALE_MIRROR_ANSWERS.map((a) => ({ value: a.value as MirrorCheck, label: a.label }))}
            value={mirror === 'not_done' ? undefined : mirror}
            onChange={setMirror}
          />
          <P small muted>
            {MIRROR_CHECK.female.note}
          </P>
          {touchCheck && extra.touch ? (
            <Card>
              <P>{touchCheck.text}</P>
              <Choice label={touchCheck.text} options={TOUCH_ANSWERS.map((a) => ({ value: a.value as TouchCheck, label: a.label }))} value={touch === 'not_done' ? undefined : touch} onChange={setTouch} />
            </Card>
          ) : touchCheck ? (
            <Button label={LEARN.alsoFingertips} kind="quiet" onPress={() => setExtra({ ...extra, touch: true })} />
          ) : null}
          {showInside && extra.inside ? (
            <Card>
              <H2>{LEARN.insideTitle}</H2>
              <P>{INSIDE_CHECK.text}</P>
              <Choice
                label={INSIDE_CHECK.text}
                options={INSIDE_ANSWERS.map((a) => ({ value: a.value as InsideCheck, label: a.label }))}
                value={inside === 'not_done' ? undefined : inside}
                onChange={setInside}
              />
            </Card>
          ) : showInside ? (
            <Button label={LEARN.addInside} kind="quiet" onPress={() => setExtra({ ...extra, inside: true })} />
          ) : null}
        </>
      ) : useTouch && touchCheck ? (
          <>
            <H2>{LEARN.checkTitle}</H2>
            <P muted>{LEARN.checkLying}</P>
            <P>{touchCheck.text}</P>
            <Choice label={touchCheck.text} options={TOUCH_ANSWERS.map((a) => ({ value: a.value as TouchCheck, label: a.label }))} value={touch === 'not_done' ? undefined : touch} onChange={setTouch} />
            <Button label={LEARN.useMirror} kind="quiet" onPress={() => setMethod('mirror')} />
          </>
        ) : (
          <>
            <H2>{touchCheck ? LEARN.mirrorTitle : LEARN.checkTitle}</H2>
            <P muted>{touchCheck ? LEARN.mirrorIntro : LEARN.checkLying}</P>
            <P>{MIRROR_CHECK[anatomy].text}</P>
            <Choice
              options={MIRROR_ANSWERS.map((a) => ({ value: a.value as MirrorCheck, label: a.label }))}
              value={mirror === 'not_done' ? undefined : mirror}
              onChange={setMirror}
            />
            {touchCheck ? <Button label={LEARN.useFingertips} kind="quiet" onPress={() => setMethod('touch')} /> : null}
          </>
        );
      footer = (
        <>
          <Button label={COMMON.continue} disabled={!answered} onPress={() => setStep('letgo')} />
          <Button label={LEARN.squeezeAgain} kind="secondary" onPress={() => setStep('squeeze')} />
        </>
      );
      if (answered) hot = () => setStep('letgo');
      break;
    }
    case 'letgo':
      body = releaseAsked ? (
        <>
          <H2>{LEARN.feltLetGo}</H2>
          <Choice
            options={[
              { value: 'yes' as const, label: COMMON.yes },
              { value: 'no' as const, label: COMMON.no },
              { value: 'unsure' as const, label: LEARN.unsure },
            ]}
            value={release}
            onChange={setRelease}
          />
        </>
      ) : (
        <>
          <H2>{LEARN.letGo}</H2>
          <LiftCircle squeezing={false} seconds={5} label={LEARN.letGoLabel} onDone={() => setReleaseAsked(true)} />
        </>
      );
      footer = releaseAsked ? <Button label={COMMON.continue} disabled={!release} onPress={() => setStep('mistakes')} /> : null;
      if (releaseAsked && release) hot = () => setStep('mistakes');
      break;
    case 'mistakes': {
      const yn = [
        { value: true, label: COMMON.yes },
        { value: false, label: COMMON.no },
      ];
      // After the first attempt, one question; the full checklist opens only on "Yes".
      const short = attempts.length > 0;
      const full = !short || off === true;
      const complete = MISTAKES.every((m) => mistakes[m.key] !== null) && mistakes.lift !== null && mistakes.leak !== null;
      const ready = short && off === false ? true : full && complete;
      const go = () => finishAttempt(short && off === false ? NOTHING_OFF : mistakes);
      body = (
        <>
          {short ? (
            <>
              <H2>{LEARN.offQuestion}</H2>
              <P muted>{LEARN.offNote}</P>
              <Segments label={LEARN.offQuestion} options={yn} value={off} onChange={setOff} />
            </>
          ) : null}
          {full ? (
            <>
              <H2>{LEARN.mistakesTitle}</H2>
              <P muted>{LEARN.mistakesNote}</P>
              {MISTAKES.map((m) => (
                <Card key={m.key}>
                  <P>{m.question}</P>
                  <Segments label={m.question} options={yn} value={mistakes[m.key] ?? undefined} onChange={(v) => setMistakes({ ...mistakes, [m.key]: v })} />
                  {mistakes[m.key] === false ? (
                    <P small muted>
                      {m.tip}
                    </P>
                  ) : null}
                </Card>
              ))}
              <Card>
                <P>{LIFT_QUESTION}</P>
                <Segments
                  options={LIFT_ANSWERS.map((a) => ({ value: a.value as LiftAnswer, label: a.label }))}
                  value={mistakes.lift ?? undefined}
                  onChange={(v) => setMistakes({ ...mistakes, lift: v })}
                />
              </Card>
              <Card>
                <P>{LEAK_QUESTION}</P>
                <Segments label={LEAK_QUESTION} options={yn} value={mistakes.leak ?? undefined} onChange={(v) => setMistakes({ ...mistakes, leak: v })} />
              </Card>
            </>
          ) : null}
        </>
      );
      footer = <Button label={COMMON.continue} disabled={!ready} busy={busy} onPress={go} />;
      if (ready && !busy) hot = go;
      break;
    }
    case 'result': {
      if (!result) break;
      const triedLying = true;
      const tips = retryTips(triedLying).map((t) =>
        t === 'another_cue' ? LEARN.tipAnotherCue : t === 'lie_down' ? (pregnant ? LEARN.tipLieDownPregnant : LEARN.tipLieDown) : t === 'other_check' ? LEARN.tipOtherCheck : LEARN.tipTomorrow,
      );
      const pass = result.result === 'pass';
      const goHome = () => router.replace('/');
      const next = pass ? (!recheck && cueKeys.length > 1 ? () => setStep('whichCue') : goNext) : null;
      body = (
        <>
          <H1>{pass ? LEARN.resultPass : result.result === 'push_down' ? LEARN.resultPushDown : LEARN.resultNotSure}</H1>
          <P>{pass ? LEARN.resultPassBody : result.result === 'push_down' ? LEARN.resultPushDownBody : LEARN.resultNotSureBody}</P>
          {!pass ? tips.map((t, i) => <P key={i}>{`• ${t}`}</P>) : null}
          {female ? <P muted>{LEARN.physioExam}</P> : null}
          {result.raisedQG5 ? (
            <Card tone="warn">
              <P>{CAUTION_CARD['Q-G5']}</P>
            </Card>
          ) : null}
          {result.canStartAnyway ? <P muted>{LEARN.startAnywayNote}</P> : null}
        </>
      );
      footer = (
        <>
          {next ? <Button label={COMMON.continue} onPress={next} /> : null}
          {result.canStartAnyway ? (
            <Button
              label={LEARN.startAnyway}
              kind="secondary"
              onPress={async () => {
                await startAnyway(db);
                bump();
                router.replace('/');
              }}
            />
          ) : null}
          {!pass ? <Button label={COMMON.done} kind={result.canStartAnyway ? 'quiet' : 'primary'} onPress={goHome} /> : null}
        </>
      );
      hot = next ?? (result.canStartAnyway ? null : goHome);
      break;
    }
    case 'whichCue': {
      const next = async () => {
        await setPreferredCue(db, cueKey);
        if (!data.prog.stop_test_shown_at) setStep('stopTest');
        else goNext();
      };
      body = (
        <>
          <H2>{LEARN.whichCue}</H2>
          <Choice label={LEARN.whichCue} options={cueKeys.map((k) => ({ value: k, label: cues.text[k] }))} value={cueKey} onChange={(k) => setCueIdx(cueKeys.indexOf(k))} />
        </>
      );
      footer = <Button label={COMMON.continue} onPress={next} />;
      hot = next;
      break;
    }
    case 'stopTest': {
      // M9: information only. The test happens later, so the app asks no "How did it go?" question now.
      const next = async () => {
        await markStopTestShown(db);
        goNext();
      };
      body = (
        <Card tone="soft">
          <H2>{STOP_TEST.title}</H2>
          <P>{STOP_TEST.card}</P>
        </Card>
      );
      footer = <Button label={COMMON.continue} onPress={next} />;
      hot = next;
      break;
    }
  }

  function goNext() {
    bump();
    // UX audit C2: after a pass, go to Today. Today offers the baseline self-check later (from the 3rd training day),
    // not straight after the attempts, when the muscles are tired.
    router.replace('/');
  }

  // Before a result is saved, leaving loses this sitting, so ask first (H8).
  const saved = step === 'result' || step === 'whichCue' || step === 'stopTest';
  return (
    <FlowScreen title={title} actions={footer} hotkey={hot} onClose={saved ? leaveFlow : () => confirmLeave()}>
      {body}
    </FlowScreen>
  );
}
