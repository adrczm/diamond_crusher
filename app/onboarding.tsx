// First-run setup (01 ONB-001 to ONB-008; 07 PRIV-040).
// UX audit C2: only what gates safety, then Today. "What to expect", the app lock and the reminder plan are Today cards
// later. H1: resumes at the saved step (profile.onboarding_step), Back on every step, "Step X of N". M7: welcome shows
// the brand, the value and the time; on desktop the step is a centred card with its actions under it.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GOAL_LABEL } from '../src/content/en/exercise';
import { OTHER_PROFILE_PHYSIO, TODO_BANNER } from '../src/content/en/screening';
import { APP_NAME, COMMON, DISCLAIMER, DISCLAIMER_VERSION, ONBOARDING } from '../src/content/en/strings';
import { activeGoals, getProfile, setGoals, updateProfile } from '../src/data/repositories/profile';
import { answersForRun, getSafetyState } from '../src/data/repositories/safety';
import { nowIso } from '../src/data/sql';
import { isBlocked, skippedSafety } from '../src/domain/safety';
import type { AgeBand, Anatomy, Goal, SafetyMode } from '../src/domain/types';
import type { QuestionKey } from '../src/domain/safety';
import { useApp } from '../src/features/app';
import { reconcileReminders } from '../src/features/reminderService';
import { COUNTED_STEPS, resumeAt, stepIndex, type OnboardingStep } from '../src/features/onboardingSteps';
import { completeScreening } from '../src/features/safetyService';
import { ImportFlow } from '../src/features/screens/BackupFlows';
import { FlowScreen, StepProgress } from '../src/features/screens/GuidedFlow';
import { ScreeningFlow, ScreeningOutcome } from '../src/features/screens/ScreeningFlow';
import { Banner, Button, Choice, H1, Loading, MultiChoice, P } from '../src/ui/kit';
import { useColors } from '../src/ui/theme';
import { Text } from '../src/ui/text';

type Step = OnboardingStep | 'import';

type Outcome = { mode: SafetyMode; reasons: QuestionKey[]; cautions: QuestionKey[]; skipped: QuestionKey[] };
const cautionsOf = (reasons: readonly QuestionKey[]) => reasons.filter((k) => k.startsWith('Q-G') || k === 'Q-F1' || k === 'Q-F2');

export default function Onboarding() {
  const { db, bump } = useApp();
  const c = useColors();
  const [step, setStep] = useState<Step | null>(null);
  const [notAdult, setNotAdult] = useState(false);
  const [anatomy, setAnatomy] = useState<Anatomy | undefined>();
  const [goals, setGoalsState] = useState<Goal[]>([]);
  const [age, setAge] = useState<AgeBand | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // H1: open at the saved step, with the answers given so far.
  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await getProfile(db);
      const g = await activeGoals(db);
      const safety = await getSafetyState(db);
      if (p?.anatomy) setAnatomy(p.anatomy);
      if (g.length) setGoalsState(g);
      if (p && p.onboarding_step > stepIndex('age')) setAge(p.age_band);
      const s = resumeAt(p?.onboarding_step ?? 0, {
        disclaimer: !!p?.disclaimer_ack_at,
        adult: !!p?.adult_confirmed_at,
        anatomy: !!p?.anatomy,
        goals: g.length > 0,
        screened: !!safety.set_by_run_id,
      });
      if (safety.set_by_run_id && (s === 'outcome' || s === 'finish')) {
        const answers = await answersForRun(db, safety.set_by_run_id);
        if (alive) setOutcome({ mode: safety.mode, reasons: safety.reasons, cautions: cautionsOf(safety.reasons), skipped: skippedSafety(answers) });
      }
      if (alive) setStep(s);
    })().catch(() => alive && setStep('welcome'));
    return () => {
      alive = false;
    };
  }, [db]);

  // Save the resume point on every step change.
  useEffect(() => {
    if (!step || step === 'import') return;
    updateProfile(db, { onboarding_step: stepIndex(step) }).catch(() => undefined);
  }, [db, step]);

  if (!step) return <Loading />;

  const go = (s: Step) => setStep(s);

  const finish = async () => {
    // "What to expect" (ED-07) is now a Today card, so expectations_ack_at stays empty until the person opens it.
    await updateProfile(db, { onboarding_completed_at: nowIso(), onboarding_step: 99 });
    reconcileReminders(db);
    bump();
    // Today shows Learn the squeeze as its main card (or the paused state when training is blocked).
    router.replace('/');
  };

  const back = (s: Step) => <Button label={COMMON.back} kind="quiet" onPress={() => go(s)} disabled={busy} />;

  let body: React.ReactNode = null;
  let actions: React.ReactNode = null;
  let hot: (() => void) | null = null;

  switch (step) {
    case 'welcome':
      body = (
        <>
          <Text style={{ fontSize: 17, fontWeight: '700', color: c.primary, letterSpacing: 0.3 }}>{APP_NAME}</Text>
          <H1>{ONBOARDING.welcomeTitle}</H1>
          <P>{ONBOARDING.welcomeValue}</P>
          <P muted>{ONBOARDING.welcomeBody}</P>
          <P muted>{ONBOARDING.welcomeTime}</P>
        </>
      );
      actions = (
        <>
          <Button label={ONBOARDING.start} onPress={() => go('disclaimer')} />
          <Button label={ONBOARDING.importBackup} kind="quiet" onPress={() => go('import')} />
        </>
      );
      hot = () => go('disclaimer');
      break;
    case 'import':
      body = (
        <ImportFlow
          fresh
          onDone={async (imported) => {
            if (!imported) return go('welcome');
            const p = await getProfile(db);
            if (p?.onboarding_completed_at) {
              reconcileReminders(db);
              router.replace('/');
            } else go('disclaimer');
          }}
        />
      );
      break;
    case 'disclaimer': {
      const next = async () => {
        await updateProfile(db, { disclaimer_ack_version: DISCLAIMER_VERSION, disclaimer_ack_at: nowIso() });
        go('adult');
      };
      body = (
        <>
          <H1>{ONBOARDING.disclaimerTitle}</H1>
          <P>{DISCLAIMER}</P>
        </>
      );
      actions = (
        <>
          <Button label={ONBOARDING.understand} onPress={next} />
          {back('welcome')}
        </>
      );
      hot = next;
      break;
    }
    case 'adult':
      body = (
        <>
          <H1>{ONBOARDING.adultQuestion}</H1>
          {notAdult ? <Banner text={ONBOARDING.notAdult} /> : null}
        </>
      );
      actions = (
        <>
          <Button
            label={COMMON.yes}
            onPress={async () => {
              await updateProfile(db, { adult_confirmed_at: nowIso() });
              setNotAdult(false);
              go('anatomy');
            }}
          />
          <Button label={COMMON.no} kind="secondary" onPress={() => setNotAdult(true)} />
          {back('disclaimer')}
        </>
      );
      break;
    case 'anatomy': {
      const next = async () => {
        await updateProfile(db, { anatomy: anatomy ?? null });
        go('goals');
      };
      body = (
        <>
          <H1>{ONBOARDING.anatomyQuestion}</H1>
          <P muted>{ONBOARDING.anatomyNote}</P>
          <Choice
            options={ONBOARDING.anatomyOptions.map((o) => ({ value: o.value as Anatomy, label: o.label }))}
            value={anatomy}
            onChange={(a) => {
              if (a !== anatomy) setGoalsState([]);
              setAnatomy(a);
            }}
          />
          {anatomy === 'female' ? <Banner text={TODO_BANNER} /> : null}
          {anatomy === 'other_unspecified' ? <Banner tone="soft" text={OTHER_PROFILE_PHYSIO} /> : null}
        </>
      );
      actions = (
        <>
          <Button label={COMMON.continue} disabled={!anatomy} onPress={next} />
          {back('adult')}
        </>
      );
      if (anatomy) hot = next;
      break;
    }
    case 'goals': {
      const options = GOAL_LABEL[anatomy ?? 'other_unspecified'];
      // Goals from another anatomy (the answer changed after a Back) do not apply.
      const chosen = goals.filter((g) => options.some((o) => o.goal === g));
      const next = async () => {
        await setGoals(db, chosen);
        go('age');
      };
      body = (
        <>
          <H1>{ONBOARDING.goalsQuestion}</H1>
          <P muted>{ONBOARDING.goalsNote}</P>
          <MultiChoice label={ONBOARDING.goalsQuestion} options={options.map((g) => ({ value: g.goal, label: g.label }))} values={chosen} onChange={setGoalsState} />
        </>
      );
      actions = (
        <>
          <Button label={COMMON.continue} disabled={chosen.length === 0} onPress={next} />
          {back('anatomy')}
        </>
      );
      if (chosen.length) hot = next;
      break;
    }
    case 'age': {
      const next = async () => {
        await updateProfile(db, { age_band: age ?? null });
        go('screening');
      };
      body = (
        <>
          <H1>{ONBOARDING.ageQuestion}</H1>
          <P muted>{ONBOARDING.ageNote}</P>
          <Choice label={ONBOARDING.ageQuestion} options={ONBOARDING.ageOptions.map((o) => ({ value: o.value as AgeBand | null, label: o.label }))} value={age} onChange={setAge} />
        </>
      );
      actions = (
        <>
          <Button label={COMMON.continue} onPress={next} />
          {back('goals')}
        </>
      );
      hot = next;
      break;
    }
    case 'screening':
      body = (
        <>
          <H1>{ONBOARDING.screeningTitle}</H1>
          <ScreeningFlow
            kind="onboarding"
            anatomy={anatomy ?? 'other_unspecified'}
            busy={busy}
            onDone={async (a) => {
              setBusy(true);
              try {
                const r = await completeScreening(db, { kind: 'onboarding', answers: a.answers, startedAt: a.startedAt, surgeryDate: a.surgeryDate });
                setOutcome({ mode: r.mode, reasons: r.reasons, cautions: cautionsOf(r.reasons), skipped: r.skipped });
                go('outcome');
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      );
      actions = back('age');
      break;
    case 'outcome':
      body = outcome ? (
        <ScreeningOutcome mode={outcome.mode} reasons={outcome.reasons} cautions={outcome.cautions} skipped={outcome.skipped} anatomy={anatomy} />
      ) : null;
      // UX audit H7 and C2: every outcome goes straight on to Today. Plan and reminder setup come later, as Today cards.
      actions = (
        <>
          <Button label={COMMON.continue} onPress={() => go('finish')} />
          {back('screening')}
        </>
      );
      hot = () => go('finish');
      break;
    case 'finish':
      body = (
        <>
          <H1>{ONBOARDING.finishTitle}</H1>
          <P>{outcome && isBlocked(outcome.mode) ? ONBOARDING.finishBlocked : ONBOARDING.finishNext}</P>
        </>
      );
      actions = (
        <>
          <Button label={COMMON.continue} onPress={finish} />
          {back('outcome')}
        </>
      );
      hot = finish;
      break;
  }

  const n = step === 'import' ? -1 : COUNTED_STEPS.indexOf(step);
  return (
    <FlowScreen
      title={APP_NAME}
      headerShown={false}
      top={n >= 0 ? <StepProgress step={n + 1} total={COUNTED_STEPS.length} label={ONBOARDING.stepOf(n + 1, COUNTED_STEPS.length)} /> : null}
      actions={actions}
      hotkey={hot}
    >
      <View style={{ gap: 16, paddingTop: 16 }}>{body}</View>
    </FlowScreen>
  );
}
