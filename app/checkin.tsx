// Symptom check-in (06c PFB-048, 01 ONB-034, 04 PRG-035): the urgent and pain questions first, routed at once through the
// safety service; then the app-own questions, one per screen, all skippable. Labelled "App question, not validated".
import { usePreventRemove } from '@react-navigation/native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useState } from 'react';
import { CHECKIN } from '../src/content/en/checkin';
import { CAUTION_CARD, OUTCOME, SKIPPED_NOTE, questionText } from '../src/content/en/screening';
import { COMMON } from '../src/content/en/strings';
import { getProfile } from '../src/data/repositories/profile';
import type { AnswerValue } from '../src/domain/questionnaire';
import { isBlocked, type QuestionKey } from '../src/domain/safety';
import { useApp, useLoad } from '../src/features/app';
import { checkinHome, checkinItems, saveCheckin, type CheckinOutcome } from '../src/features/checkinService';
import { reconcileReminders } from '../src/features/reminderService';
import { completeScreening, type ScreeningResult } from '../src/features/safetyService';
import { confirmLeave, leaveFlow } from '../src/features/screens/GuidedFlow';
import { ScreeningFlow, ScreeningOutcome } from '../src/features/screens/ScreeningFlow';
import { Button, Card, Choice, H1, H2, Label, Loading, P, Screen } from '../src/ui/kit';

type Step = 'intro' | 'safety' | 'items' | 'result';

export default function CheckinScreen() {
  const params = useLocalSearchParams<{ reason?: string }>();
  const { db, bump } = useApp();
  const { data, reload, error } = useLoad(async (d) => ({ profile: await getProfile(d), home: await checkinHome(d) }));
  const [step, setStep] = useState<Step>('intro');
  const [screen, setScreen] = useState<ScreeningResult | null>(null);
  const [ii, setIi] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [startedAt, setStartedAt] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<CheckinOutcome | null>(null);
  const navigation = useNavigation();
  usePreventRemove(step === 'items' && Object.keys(answers).length > 0, ({ data: e }) => confirmLeave(() => navigation.dispatch(e.action)));
  if (!data) return <Loading error={error} onRetry={reload} />;
  const anatomy = data.profile?.anatomy ?? 'other_unspecified';
  const items = checkinItems(anatomy);

  if (step === 'intro') {
    const reasons = Array.from(new Set([...(params.reason ? [params.reason] : []), ...data.home.offers]));
    return (
      <Screen title={CHECKIN.title} footer={<Button label={CHECKIN.start} onPress={() => setStep('safety')} />}>
        <H1>{CHECKIN.title}</H1>
        <P small muted>
          {CHECKIN.label}
        </P>
        <P>{CHECKIN.intro}</P>
        {reasons.map((r) => (CHECKIN.why[r] ? <P key={r} muted>{CHECKIN.why[r]}</P> : null))}
      </Screen>
    );
  }

  if (step === 'safety') {
    return (
      <Screen title={CHECKIN.title}>
        <H1>{CHECKIN.safetyTitle}</H1>
        <ScreeningFlow
          kind="something_changed"
          topics={['pain']}
          anatomy={anatomy}
          busy={busy}
          onDone={async (a) => {
            setBusy(true);
            try {
              // ONB-034: never delayed by any cooldown. The screening_run kind stays `something_changed`.
              const r = await completeScreening(db, { kind: 'something_changed', answers: a.answers, startedAt: a.startedAt, sourceRef: 'symptom_checkin' });
              setScreen(r);
              reconcileReminders(db);
              bump();
              setStartedAt(new Date());
              setStep(isBlocked(r.mode) ? 'result' : 'items');
            } finally {
              setBusy(false);
            }
          }}
        />
      </Screen>
    );
  }

  if (step === 'items') {
    const item = items[ii];
    const value = answers[item.itemId];
    const next = async (v: AnswerValue | undefined) => {
      const a = { ...answers, [item.itemId]: v === undefined ? null : v };
      setAnswers(a);
      if (ii + 1 < items.length) return setIi(ii + 1);
      setBusy(true);
      try {
        setOutcome(await saveCheckin(db, a, { startedAt }));
        reconcileReminders(db);
        bump();
        setStep('result');
      } finally {
        setBusy(false);
      }
    };
    return (
      <Screen
        title={CHECKIN.title}
        footer={
          <>
            <Button label={COMMON.next} disabled={value == null} busy={busy} onPress={() => next(value)} />
            <Button label={COMMON.skipQuestion} kind="quiet" disabled={busy} onPress={() => next(undefined)} />
            {ii > 0 ? <Button label={COMMON.back} kind="secondary" disabled={busy} onPress={() => setIi(ii - 1)} /> : null}
          </>
        }
      >
        <P small muted>
          {CHECKIN.label}
        </P>
        <Label>{CHECKIN.questionOf(ii + 1, items.length)}</Label>
        <H2>{item.text}</H2>
        <Choice label={item.text} options={item.options.map((o) => ({ value: o.value, label: o.label }))} value={value as number | string | undefined} onChange={(v) => setAnswers({ ...answers, [item.itemId]: v })} />
      </Screen>
    );
  }

  // Result: the safety route first (urgent, pain), then the hold, the caution cards and the firmer card.
  const mode = screen?.mode ?? 'normal';
  const routed = mode !== 'normal' && mode !== 'caution';
  const cautions = Array.from(new Set<string>([...(screen?.newCautions ?? []), ...(outcome?.cautionKeys ?? [])]));
  const skipped: QuestionKey[] = screen?.skipped ?? [];
  return (
    <Screen title={CHECKIN.title} footer={<Button label={COMMON.done} onPress={leaveFlow} />}>
      {routed && screen ? <ScreeningOutcome mode={screen.mode} reasons={screen.reasons} cautions={[]} skipped={[]} anatomy={anatomy} /> : null}
      {outcome?.relaxOnly && !routed ? (
        <>
          <H1>{OUTCOME.relax_only.title}</H1>
          <P>{OUTCOME.relax_only.body}</P>
          <P muted>{CHECKIN.result.painRoute}</P>
        </>
      ) : null}
      {outcome ? (
        <>
          {!routed && !outcome.relaxOnly ? <H1>{outcome.holdActive ? CHECKIN.result.worseTitle : CHECKIN.result.savedTitle}</H1> : null}
          {outcome.holdActive ? <P>{CHECKIN.result.worse}</P> : null}
          {outcome.holdActive && !routed && !outcome.relaxOnly ? <P>{CHECKIN.result.keepTraining}</P> : null}
          {outcome.holdActive ? <P muted>{CHECKIN.result.technique}</P> : null}
          {outcome.holdReleased ? <P>{CHECKIN.result.released}</P> : null}
          {cautions.map((k) => (
            <Card key={k} tone="warn">
              <P>{CAUTION_CARD[k]}</P>
            </Card>
          ))}
          {outcome.escalated ? (
            <Card tone="warn">
              <H2>{CHECKIN.escalation.body}</H2>
              <P>{CHECKIN.escalation.keepTraining}</P>
            </Card>
          ) : null}
          <P small muted>
            {CHECKIN.result.saved}
          </P>
        </>
      ) : null}
      {skipped.length && !routed ? (
        <Card tone="warn">
          <P>{SKIPPED_NOTE}</P>
          {skipped.map((k) => (
            <P key={k} small>
              {`• ${questionText(k, anatomy)}`}
            </P>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
