// Questionnaire runner (06b QST-020 to QST-045): one item per screen, skippable, recall period on every item.
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { useState } from 'react';
import { APP_QUESTION_LABEL } from '../src/content/en/items';
import { BUNDLE, COMMON } from '../src/content/en/strings';
import { activeGoals } from '../src/data/repositories/profile';
import { listScheduledChecks } from '../src/data/repositories/checks';
import { itemVisible, type AnswerValue, type ModuleItem } from '../src/domain/questionnaire';
import type { BundleKind } from '../src/domain/schedule';
import { useApp, useLoad } from '../src/features/app';
import { confirmLeave, leaveFlow } from '../src/features/screens/GuidedFlow';
import { markPart, modulesForCheck, saveQuestionnaire, type BundlePart } from '../src/features/checkService';
import { Button, Choice, H2, Label, Loading, P, Screen, Segments } from '../src/ui/kit';

export default function QuestionnaireScreen() {
  const params = useLocalSearchParams<{ checkId?: string; parts?: string }>();
  const { db, bump } = useApp();
  const { data, reload: loadRetry, error: loadError } = useLoad(async (d) => {
    const row = (await listScheduledChecks(d)).find((r) => r.id === params.checkId);
    const kind = (row?.kind ?? 'monthly_check') as BundleKind;
    return { kind, modules: await modulesForCheck(d, kind), goals: await activeGoals(d) };
  });
  const [mi, setMi] = useState(0);
  const [ii, setIi] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [startedAt, setStartedAt] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  // Leaving with answers asks first (DS-E16).
  const navigation = useNavigation();
  usePreventRemove(Object.keys(answers).length > 0 && !finished, ({ data: e }) => confirmLeave(() => navigation.dispatch(e.action)));
  if (!data) return <Loading error={loadError} onRetry={loadRetry} />;
  const m = data.modules[mi];
  const finishAll = async () => {
    if (params.checkId && params.parts) await markPart(db, params.checkId, 'questionnaires', params.parts.split(',') as BundlePart[]);
    bump();
    setFinished(true);
    setTimeout(leaveFlow, 0);
  };
  if (!m) {
    return (
      <Screen title={BUNDLE.parts.questionnaires} footer={<Button label={COMMON.done} onPress={finishAll} />}>
        <P>{BUNDLE.noValidated}</P>
      </Screen>
    );
  }
  const items: ModuleItem[] = m.items.filter((i) => itemVisible(i, answers) && (!i.goals || i.goals.some((g) => (data.goals as string[]).includes(g))));
  const item = items[ii];
  const set = (v: AnswerValue) => setAnswers({ ...answers, [item.itemId]: v });
  const next = async (v: AnswerValue | undefined) => {
    const a = { ...answers, [item.itemId]: v === undefined ? null : v };
    setAnswers(a);
    if (ii + 1 < items.length) return setIi(ii + 1);
    setBusy(true);
    try {
      const ctx = data.kind === 'quarterly_review' ? 'quarterly' : params.checkId ? 'monthly' : 'ad_hoc';
      await saveQuestionnaire(db, m, a, { startedAt, scheduledCheckId: params.checkId ?? null, context: ctx });
      if (mi + 1 < data.modules.length) {
        setMi(mi + 1);
        setIi(0);
        setAnswers({});
        setStartedAt(new Date());
      } else await finishAll();
    } finally {
      setBusy(false);
    }
  };
  const value = answers[item.itemId];
  return (
    <Screen
      title={m.name}
      footer={
        <>
          <Button label={COMMON.next} disabled={value == null} busy={busy} onPress={() => next(value)} />
          <Button label={COMMON.skipQuestion} kind="quiet" disabled={busy} onPress={() => next(undefined)} />
          {ii > 0 ? <Button label={COMMON.back} kind="secondary" disabled={busy} onPress={() => setIi(ii - 1)} /> : null}
        </>
      }
    >
      <P small muted>
        {m.validated ? BUNDLE.validatedLabel(m.name) : APP_QUESTION_LABEL}
      </P>
      {ii === 0 ? <P muted>{m.instructions}</P> : null}
      <Label>{`${m.recall.text} · ${ii + 1} of ${items.length}`}</Label>
      <H2>{item.text}</H2>
      {item.responseType === 'numeric' && item.scale ? (
        <>
          <Segments
            options={Array.from({ length: item.scale.max - item.scale.min + 1 }, (_, k) => ({ value: item.scale!.min + k, label: String(item.scale!.min + k) }))}
            value={typeof value === 'number' ? value : undefined}
            onChange={set}
          />
          <P small muted>{`${item.scale.min} = ${item.scale.minLabel}, ${item.scale.max} = ${item.scale.maxLabel}`}</P>
        </>
      ) : (
        <Choice label={item.text} options={item.options.map((o) => ({ value: o.value, label: o.label }))} value={value as number | string | undefined} onChange={set} />
      )}
    </Screen>
  );
}
