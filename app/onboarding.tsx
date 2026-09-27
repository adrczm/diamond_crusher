// First-run setup (01 ONB-001 to ONB-008; 08 REM-001 to REM-006; 07 PRIV-010).
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { EDUCATION } from '../src/content/en/education';
import { GOAL_LABEL } from '../src/content/en/exercise';
import { OTHER_PROFILE_PHYSIO, TODO_BANNER } from '../src/content/en/screening';
import { APP_NAME, COMMON, DISCLAIMER, DISCLAIMER_VERSION, ONBOARDING, PLAN } from '../src/content/en/strings';
import { getProfile, setGoals, updateProfile } from '../src/data/repositories/profile';
import { savePlan, type SlotPlan } from '../src/data/repositories/reminders';
import { updateSettings } from '../src/data/repositories/settings';
import { nowIso } from '../src/data/sql';
import { setLock } from '../src/data/vault';
import { isBlocked } from '../src/domain/safety';
import type { AgeBand, Anatomy, Goal, SafetyMode } from '../src/domain/types';
import type { QuestionKey } from '../src/domain/safety';
import { useApp, withoutRelock } from '../src/features/app';
import { reconcileReminders } from '../src/features/reminderService';
import { completeScreening } from '../src/features/safetyService';
import { ImportFlow } from '../src/features/screens/BackupFlows';
import { defaultPlan, PlanEditor, planValid, resizePlan } from '../src/features/screens/PlanEditor';
import { ScreeningFlow, ScreeningOutcome } from '../src/features/screens/ScreeningFlow';
import { auth } from '../src/platform/auth';
import { requestPermission, sendTest } from '../src/platform/notifications';
import { Banner, Button, Card, Choice, H1, H2, MultiChoice, P, Screen, Segments } from '../src/ui/kit';

type Step =
  | 'welcome'
  | 'import'
  | 'disclaimer'
  | 'adult'
  | 'anatomy'
  | 'goals'
  | 'age'
  | 'screening'
  | 'outcome'
  | 'expect'
  | 'lock'
  | 'plan'
  | 'permission'
  | 'test'
  | 'finish';

export default function Onboarding() {
  const { db, boot, setBoot, bump } = useApp();
  const [step, setStep] = useState<Step>('welcome');
  const [notAdult, setNotAdult] = useState(false);
  const [anatomy, setAnatomy] = useState<Anatomy | undefined>();
  const [goals, setGoalsState] = useState<Goal[]>([]);
  const [age, setAge] = useState<AgeBand | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ mode: SafetyMode; reasons: QuestionKey[]; cautions: QuestionKey[] } | null>(null);
  const [lockAvailable, setLockAvailable] = useState<boolean | null>(null);
  const [perDay, setPerDay] = useState(3);
  const [plan, setPlan] = useState<SlotPlan[]>(defaultPlan(3));
  const [testState, setTestState] = useState<'idle' | 'sent' | 'no'>('idle');

  useEffect(() => {
    auth
      .available()
      .then(setLockAvailable)
      .catch(() => setLockAvailable(false));
  }, []);

  const go = (s: Step) => setStep(s);

  const finish = async () => {
    await updateProfile(db, { onboarding_completed_at: nowIso(), expectations_ack_at: nowIso(), onboarding_step: 99 });
    reconcileReminders(db);
    bump();
    router.replace(outcome && isBlocked(outcome.mode) ? '/' : '/learn');
  };

  const title = APP_NAME;
  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  switch (step) {
    case 'welcome':
      body = (
        <>
          <H1>{ONBOARDING.welcomeTitle}</H1>
          <P>{ONBOARDING.welcomeBody}</P>
        </>
      );
      footer = (
        <>
          <Button label={ONBOARDING.start} onPress={() => go('disclaimer')} />
          <Button label={ONBOARDING.importBackup} kind="quiet" onPress={() => go('import')} />
        </>
      );
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
    case 'disclaimer':
      body = (
        <>
          <H1>Before you start</H1>
          <P>{DISCLAIMER}</P>
        </>
      );
      footer = (
        <Button
          label={ONBOARDING.understand}
          onPress={async () => {
            await updateProfile(db, { disclaimer_ack_version: DISCLAIMER_VERSION, disclaimer_ack_at: nowIso(), onboarding_step: 1 });
            go('adult');
          }}
        />
      );
      break;
    case 'adult':
      body = (
        <>
          <H1>{ONBOARDING.adultQuestion}</H1>
          {notAdult ? <Banner text={ONBOARDING.notAdult} /> : null}
        </>
      );
      footer = (
        <>
          <Button
            label={COMMON.yes}
            onPress={async () => {
              await updateProfile(db, { adult_confirmed_at: nowIso(), onboarding_step: 2 });
              go('anatomy');
            }}
          />
          <Button label={COMMON.no} kind="secondary" onPress={() => setNotAdult(true)} />
        </>
      );
      break;
    case 'anatomy':
      body = (
        <>
          <H1>{ONBOARDING.anatomyQuestion}</H1>
          <P muted>{ONBOARDING.anatomyNote}</P>
          <Choice
            options={ONBOARDING.anatomyOptions.map((o) => ({ value: o.value as Anatomy, label: o.label }))}
            value={anatomy}
            onChange={(a) => {
              setAnatomy(a);
              setGoalsState([]);
            }}
          />
          {anatomy === 'female' ? <Banner text={TODO_BANNER} /> : null}
          {anatomy === 'other_unspecified' ? <Banner tone="soft" text={OTHER_PROFILE_PHYSIO} /> : null}
        </>
      );
      footer = (
        <Button
          label={COMMON.continue}
          disabled={!anatomy}
          onPress={async () => {
            await updateProfile(db, { anatomy: anatomy ?? null, onboarding_step: 3 });
            go('goals');
          }}
        />
      );
      break;
    case 'goals':
      body = (
        <>
          <H1>{ONBOARDING.goalsQuestion}</H1>
          <P muted>{ONBOARDING.goalsNote}</P>
          <MultiChoice options={GOAL_LABEL[anatomy ?? 'other_unspecified'].map((g) => ({ value: g.goal, label: g.label }))} values={goals} onChange={setGoalsState} />
        </>
      );
      footer = (
        <Button
          label={COMMON.continue}
          disabled={goals.length === 0}
          onPress={async () => {
            await setGoals(db, goals);
            await updateProfile(db, { onboarding_step: 4 });
            go('age');
          }}
        />
      );
      break;
    case 'age':
      body = (
        <>
          <H1>{ONBOARDING.ageQuestion}</H1>
          <P muted>{ONBOARDING.ageNote}</P>
          <Choice options={ONBOARDING.ageOptions.map((o) => ({ value: o.value as AgeBand | null, label: o.label }))} value={age} onChange={setAge} />
        </>
      );
      footer = (
        <Button
          label={COMMON.continue}
          onPress={async () => {
            await updateProfile(db, { age_band: age ?? null, onboarding_step: 5 });
            go('screening');
          }}
        />
      );
      break;
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
                setOutcome({ mode: r.mode, reasons: r.reasons, cautions: r.reasons.filter((k) => k.startsWith('Q-G') || k === 'Q-F1' || k === 'Q-F2') });
                await updateProfile(db, { onboarding_step: 6 });
                go('outcome');
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      );
      break;
    case 'outcome':
      body = outcome ? <ScreeningOutcome mode={outcome.mode} reasons={outcome.reasons} cautions={outcome.cautions} /> : null;
      footer = <Button label={COMMON.continue} onPress={() => go('expect')} />;
      break;
    case 'expect': {
      const ed = EDUCATION.find((e) => e.id === 'ED-07');
      body = (
        <>
          <H1>{ed?.title ?? ''}</H1>
          {ed?.body.map((b, i) => (
            <P key={i}>{b}</P>
          ))}
        </>
      );
      // The app lock needs a phone's fingerprint, face or PIN; the web version skips it.
      footer = <Button label={COMMON.continue} onPress={() => go(Platform.OS === 'web' ? 'plan' : 'lock')} />;
      break;
    }
    case 'lock':
      body = (
        <>
          <H1>{ONBOARDING.lockTitle}</H1>
          <P>{ONBOARDING.lockBody}</P>
          {lockAvailable === false ? <Banner text={ONBOARDING.lockUnavailable} /> : <P muted>{ONBOARDING.lockWarning}</P>}
        </>
      );
      footer = (
        <>
          {lockAvailable ? (
            <Button
              label={ONBOARDING.lockOn}
              busy={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  setBoot(await withoutRelock(() => setLock(db, boot, true)));
                  go('plan');
                } catch {
                  // Cancelled or failed: stay here, lock off.
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : null}
          <Button label={ONBOARDING.lockOff} kind={lockAvailable ? 'quiet' : 'primary'} onPress={() => go('plan')} disabled={busy} />
        </>
      );
      break;
    case 'plan':
      body = (
        <>
          <H1>{PLAN.title}</H1>
          <P muted>{PLAN.intro}</P>
          <H2>{PLAN.sessionsPerDay}</H2>
          <Segments
            options={[
              { value: 2, label: '2' },
              { value: 3, label: '3' },
            ]}
            value={perDay}
            onChange={(n) => {
              setPerDay(n);
              setPlan(resizePlan(plan, n));
            }}
          />
          <PlanEditor plan={plan} onChange={setPlan} minutes={5} />
        </>
      );
      footer = (
        <Button
          label={COMMON.continue}
          disabled={!planValid(plan)}
          onPress={async () => {
            await updateSettings(db, { sessions_per_day_target: perDay });
            await savePlan(db, plan);
            await updateProfile(db, { onboarding_step: 9 });
            go('permission');
          }}
        />
      );
      break;
    case 'permission':
      body = (
        <>
          <H1>Reminders</H1>
          <P>{PLAN.permissionWhy}</P>
          <P muted>{PLAN.mayBeLate}</P>
        </>
      );
      footer = (
        <>
          <Button
            label={PLAN.allowReminders}
            onPress={async () => {
              const p = await withoutRelock(() => requestPermission());
              await updateSettings(db, { notification_permission: p });
              go(p === 'granted' ? 'test' : 'finish');
            }}
          />
          <Button label={PLAN.noReminders} kind="quiet" onPress={() => go('finish')} />
        </>
      );
      break;
    case 'test':
      body = (
        <>
          <H1>{PLAN.testTitle}</H1>
          <P>{PLAN.testBody}</P>
          {testState === 'sent' ? <H2>{PLAN.testQuestion}</H2> : null}
          {testState === 'no' ? (
            <Card tone="warn">
              <H2>{PLAN.testFixTitle}</H2>
              {PLAN.testFix.map((t, i) => (
                <P key={i}>{`• ${t}`}</P>
              ))}
              {Platform.OS !== 'web' ? (
                <Button label={PLAN.openSettings} kind="secondary" onPress={() => withoutRelock(() => Linking.openSettings())} />
              ) : null}
            </Card>
          ) : null}
        </>
      );
      footer =
        testState === 'sent' ? (
          <>
            <Button
              label={COMMON.yes}
              onPress={async () => {
                await updateSettings(db, { last_delivery_test_at: nowIso(), last_delivery_test_result: 'seen' });
                go('finish');
              }}
            />
            <Button
              label={COMMON.no}
              kind="secondary"
              onPress={async () => {
                await updateSettings(db, { last_delivery_test_at: nowIso(), last_delivery_test_result: 'not_seen' });
                setTestState('no');
              }}
            />
          </>
        ) : (
          <>
            <Button
              label={PLAN.sendTest}
              onPress={async () => {
                await sendTest();
                setTestState('sent');
              }}
            />
            <Button label={COMMON.skip} kind="quiet" onPress={() => go('finish')} />
          </>
        );
      break;
    case 'finish':
      body = (
        <>
          <H1>All set</H1>
          <P>
            {outcome && isBlocked(outcome.mode)
              ? 'Your home screen shows what happens next.'
              : 'Next: learn the squeeze. It takes about 5 minutes, lying down.'}
          </P>
        </>
      );
      footer = <Button label={COMMON.continue} onPress={finish} />;
      break;
  }

  return (
    <Screen title={title} footer={footer} headerShown={false}>
      <View style={{ gap: 16, paddingTop: 16 }}>{body}</View>
    </Screen>
  );
}
