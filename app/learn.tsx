// Learn the squeeze (spec 02): 3 to 5 guided attempts with a self-check and a mistakes checklist.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../src/ui/text';
import { EDUCATION } from '../src/content/en/education';
import {
  CUES,
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
  cueText,
} from '../src/content/en/learn';
import { CAUTION_CARD, TODO_BANNER } from '../src/content/en/screening';
import { COMMON } from '../src/content/en/strings';
import { markContentSeen, seenContent } from '../src/data/repositories/misc';
import { getProfile } from '../src/data/repositories/profile';
import { getProgramme } from '../src/data/repositories/programme';
import { getSafetyState } from '../src/data/repositories/safety';
import { classifyAttempt, retryTips, sittingShouldEnd, type LiftAnswer, type MirrorCheck, type Mistakes, type ReleaseAnswer, type SittingResult, type TouchCheck } from '../src/domain/learn';
import { strengthAllowed } from '../src/domain/safety';
import { useApp, useLoad } from '../src/features/app';
import { saveSitting, saveStopTest, setPreferredCue, startAnyway, type AttemptRecord } from '../src/features/learnService';
import { reconcileReminders } from '../src/features/reminderService';
import { raiseQG5 } from '../src/features/safetyService';
import { Banner, Button, Card, Choice, H1, H2, Label, Loading, P, Screen, Segments } from '../src/ui/kit';
import { useColors } from '../src/ui/theme';
import { useCountdown } from '../src/ui/useCountdown';

type Step = 'edu' | 'intro' | 'relax' | 'cue' | 'squeeze' | 'check' | 'letgo' | 'mistakes' | 'result' | 'whichCue' | 'stopTest';

const EMPTY_MISTAKES: Mistakes = { breathing: null, buttocks: null, thighs: null, tummy: null, lift: null, leak: null };

function BigCount({ seconds, label, onDone }: { seconds: number; label: string; onDone: () => void }) {
  const c = useColors();
  const left = useCountdown(seconds, true, onDone);
  return (
    <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }} accessibilityLiveRegion="polite">
      <Text style={{ fontSize: 20, color: c.muted }}>{label}</Text>
      <Text style={{ fontSize: 72, fontWeight: '700', color: c.primary }}>{left}</Text>
    </View>
  );
}

export default function Learn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const recheck = params.mode === 'recheck';
  const { db, bump } = useApp();
  const { data } = useLoad(async (d) => ({
    profile: await getProfile(d),
    prog: await getProgramme(d),
    safety: await getSafetyState(d),
    seen: await seenContent(d),
  }));
  const [step, setStep] = useState<Step | null>(null);
  const [eduIndex, setEduIndex] = useState(0);
  const [cueIdx, setCueIdx] = useState(0);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [startedAt, setStartedAt] = useState('');
  const [method, setMethod] = useState<'mirror' | 'touch'>('mirror');
  const [mirror, setMirror] = useState<MirrorCheck>('not_done');
  const [touch, setTouch] = useState<TouchCheck>('not_done');
  const [release, setRelease] = useState<ReleaseAnswer | undefined>();
  const [releaseAsked, setReleaseAsked] = useState(false);
  const [mistakes, setMistakes] = useState<Mistakes>(EMPTY_MISTAKES);
  const [result, setResult] = useState<{ result: SittingResult; canStartAnyway: boolean; raisedQG5: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const eduScreens = EDUCATION.filter((e) => e.id === 'ED-01' || e.id === 'ED-06');

  useEffect(() => {
    if (!data || step) return;
    const needEdu = !recheck && eduScreens.some((e) => !data.seen.has(e.id));
    setStep(needEdu ? 'edu' : 'intro');
    const set = CUES[data.profile?.anatomy ?? 'other_unspecified'];
    const pref = data.profile?.preferred_cue_key ? set.keys.indexOf(data.profile.preferred_cue_key) : -1;
    if (pref >= 0) setCueIdx(pref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data || !step) return <Loading />;
  const anatomy = data.profile?.anatomy ?? 'other_unspecified';
  const cues = CUES[anatomy];
  const cueKey = cues.keys[cueIdx % cues.keys.length];
  const touchCheck = TOUCH_CHECK[anatomy];
  const allowed = strengthAllowed(data.safety.mode);

  if (!allowed) {
    return (
      <Screen title={LEARN.title}>
        <Banner text="Learn the squeeze is not available while exercises are paused or set to relaxation only." />
        <Button label={COMMON.back} onPress={() => router.back()} />
      </Screen>
    );
  }

  const newAttempt = () => {
    setStartedAt(new Date().toISOString());
    setMirror('not_done');
    setTouch('not_done');
    setRelease(undefined);
    setReleaseAsked(false);
    setMistakes(EMPTY_MISTAKES);
    setStep('relax');
  };

  const finishAttempt = async () => {
    const rec: AttemptRecord = { startedAt, cueKey, checkMirror: mirror, checkTouch: touch, feltRelease: release ?? 'unsure', mistakes };
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
  const attemptLabel = recheck ? '' : `Attempt ${attempts.length + 1} of up to 5`;
  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  switch (step) {
    case 'edu': {
      const e = eduScreens[eduIndex];
      body = (
        <>
          <H1>{e.title}</H1>
          {e.body.map((b, i) => (
            <P key={i}>{b}</P>
          ))}
        </>
      );
      footer = (
        <Button
          label={COMMON.next}
          onPress={async () => {
            await markContentSeen(db, e.id);
            if (eduIndex + 1 < eduScreens.length) setEduIndex(eduIndex + 1);
            else setStep('intro');
          }}
        />
      );
      break;
    }
    case 'intro':
      body = (
        <>
          <H1>{title}</H1>
          <P>{recheck ? LEARN.recheckIntro : LEARN.intro}</P>
          {!recheck ? <P muted>{LEARN.howItWorks}</P> : null}
          {cues.todo ? <Banner text={TODO_BANNER} /> : null}
        </>
      );
      footer = <Button label={COMMON.continue} onPress={newAttempt} />;
      break;
    case 'relax':
      body = (
        <>
          <Label>{attemptLabel}</Label>
          <H2>{attempts.length === 0 ? LEARN.relax : LEARN.relaxShort}</H2>
          <BigCount seconds={attempts.length === 0 ? 30 : 10} label="Breathe slowly" onDone={() => setStep('cue')} />
        </>
      );
      footer = <Button label={COMMON.skip} kind="quiet" onPress={() => setStep('cue')} />;
      break;
    case 'cue':
      body = (
        <>
          <Label>{LEARN.cueTitle}</Label>
          <H1>{cueText(cueKey, anatomy)}</H1>
        </>
      );
      footer = (
        <>
          <Button label={LEARN.ready} onPress={() => setStep('squeeze')} />
          {cues.keys.length > 1 ? <Button label={LEARN.anotherCue} kind="quiet" onPress={() => setCueIdx(cueIdx + 1)} /> : null}
        </>
      );
      break;
    case 'squeeze':
      body = (
        <>
          <H2>{LEARN.squeeze}</H2>
          <BigCount seconds={3} label={cueText(cueKey, anatomy)} onDone={() => setStep('check')} />
        </>
      );
      break;
    case 'check':
      body = (
        <>
          <H2>{LEARN.checkTitle}</H2>
          <P muted>{LEARN.checkChoose}</P>
          {touchCheck ? (
            <Segments
              options={[
                { value: 'mirror' as const, label: LEARN.mirrorLabel },
                { value: 'touch' as const, label: LEARN.touchLabel },
              ]}
              value={method}
              onChange={setMethod}
            />
          ) : null}
          {method === 'mirror' || !touchCheck ? (
            <>
              <P>{MIRROR_CHECK[anatomy].text}</P>
              <Choice options={MIRROR_ANSWERS.map((a) => ({ value: a.value as MirrorCheck, label: a.label }))} value={mirror === 'not_done' ? undefined : mirror} onChange={setMirror} />
            </>
          ) : (
            <>
              <P>{touchCheck.text}</P>
              <Choice options={TOUCH_ANSWERS.map((a) => ({ value: a.value as TouchCheck, label: a.label }))} value={touch === 'not_done' ? undefined : touch} onChange={setTouch} />
            </>
          )}
        </>
      );
      footer = (
        <>
          <Button label={COMMON.continue} disabled={mirror === 'not_done' && touch === 'not_done'} onPress={() => setStep('letgo')} />
          <Button label={LEARN.squeezeAgain} kind="quiet" onPress={() => setStep('squeeze')} />
        </>
      );
      break;
    case 'letgo':
      body = releaseAsked ? (
        <>
          <H2>{LEARN.feltLetGo}</H2>
          <Choice
            options={[
              { value: 'yes' as const, label: COMMON.yes },
              { value: 'no' as const, label: COMMON.no },
              { value: 'unsure' as const, label: 'Unsure' },
            ]}
            value={release}
            onChange={setRelease}
          />
        </>
      ) : (
        <>
          <H2>{LEARN.letGo}</H2>
          <BigCount seconds={5} label="Let go" onDone={() => setReleaseAsked(true)} />
        </>
      );
      footer = releaseAsked ? <Button label={COMMON.continue} disabled={!release} onPress={() => setStep('mistakes')} /> : null;
      break;
    case 'mistakes': {
      const yn = [
        { value: true, label: COMMON.yes },
        { value: false, label: COMMON.no },
      ];
      const complete = MISTAKES.every((m) => mistakes[m.key] !== null) && mistakes.lift !== null && mistakes.leak !== null;
      body = (
        <>
          <H2>{LEARN.mistakesTitle}</H2>
          <P muted>{LEARN.mistakesNote}</P>
          {MISTAKES.map((m) => (
            <Card key={m.key}>
              <P>{m.question}</P>
              <Segments options={yn} value={mistakes[m.key] ?? undefined} onChange={(v) => setMistakes({ ...mistakes, [m.key]: v })} />
              {mistakes[m.key] === false ? <P small muted>{m.tip}</P> : null}
            </Card>
          ))}
          <Card>
            <P>{LIFT_QUESTION}</P>
            <Segments options={LIFT_ANSWERS.map((a) => ({ value: a.value as LiftAnswer, label: a.label }))} value={mistakes.lift ?? undefined} onChange={(v) => setMistakes({ ...mistakes, lift: v })} />
          </Card>
          <Card>
            <P>{LEAK_QUESTION}</P>
            <Segments options={yn} value={mistakes.leak ?? undefined} onChange={(v) => setMistakes({ ...mistakes, leak: v })} />
          </Card>
        </>
      );
      footer = <Button label={COMMON.continue} disabled={!complete} busy={busy} onPress={finishAttempt} />;
      break;
    }
    case 'result': {
      if (!result) break;
      const triedLying = true;
      const tips = retryTips(triedLying).map((t) =>
        t === 'another_cue' ? LEARN.tipAnotherCue : t === 'lie_down' ? LEARN.tipLieDown : t === 'other_check' ? LEARN.tipOtherCheck : LEARN.tipTomorrow
      );
      const pass = result.result === 'pass';
      body = (
        <>
          <H1>{pass ? LEARN.resultPass : result.result === 'push_down' ? LEARN.resultPushDown : LEARN.resultNotSure}</H1>
          <P>{pass ? LEARN.resultPassBody : result.result === 'push_down' ? LEARN.resultPushDownBody : LEARN.resultNotSureBody}</P>
          {!pass ? tips.map((t, i) => <P key={i}>{`• ${t}`}</P>) : null}
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
          {pass && !recheck && cues.keys.length > 1 ? <Button label={COMMON.continue} onPress={() => setStep('whichCue')} /> : null}
          {pass && (recheck || cues.keys.length <= 1) ? <Button label={COMMON.continue} onPress={() => goNext()} /> : null}
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
          {!pass ? <Button label={COMMON.done} kind={result.canStartAnyway ? 'quiet' : 'primary'} onPress={() => router.replace('/')} /> : null}
        </>
      );
      break;
    }
    case 'whichCue':
      body = (
        <>
          <H2>{LEARN.whichCue}</H2>
          <Choice options={cues.keys.map((k) => ({ value: k, label: cues.text[k] }))} value={cueKey} onChange={(k) => setCueIdx(cues.keys.indexOf(k))} />
        </>
      );
      footer = (
        <Button
          label={COMMON.continue}
          onPress={async () => {
            await setPreferredCue(db, cueKey);
            if (!data.prog.stop_test_shown_at) setStep('stopTest');
            else goNext();
          }}
        />
      );
      break;
    case 'stopTest':
      body = (
        <>
          <H2>Optional</H2>
          <P>{STOP_TEST.card}</P>
          <P muted>{STOP_TEST.resultQuestion}</P>
        </>
      );
      footer = (
        <>
          <Button label={STOP_TEST.could} kind="secondary" onPress={async () => (await saveStopTest(db, 'could'), goNext())} />
          <Button
            label={STOP_TEST.couldNot}
            kind="secondary"
            onPress={async () => {
              await saveStopTest(db, 'could_not');
              await raiseQG5(db);
              goNext();
            }}
          />
          <Button label={STOP_TEST.skip} kind="quiet" onPress={async () => (await saveStopTest(db, 'skipped'), goNext())} />
        </>
      );
      break;
  }

  function goNext() {
    bump();
    // LRN-033: after a first pass, hand off to the baseline self-check.
    if (!recheck && result?.result === 'pass') router.replace('/selfcheck?kind=baseline');
    else router.replace('/');
  }

  return (
    <Screen title={title} footer={footer}>
      {body}
    </Screen>
  );
}
