// "Something changed?", the periodic short re-check, and re-runs after a body change (ONB-030 to ONB-032).
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { COMMON, HOME } from '../src/content/en/strings';
import { getProfile } from '../src/data/repositories/profile';
import { CHANGE_TOPICS } from '../src/content/en/screening';
import type { ChangeTopic, QuestionKey, ScreeningKind } from '../src/domain/safety';
import type { SafetyMode } from '../src/domain/types';
import { useApp, useLoad } from '../src/features/app';
import { markPart, type BundlePart } from '../src/features/checkService';
import { reconcileReminders } from '../src/features/reminderService';
import { completeScreening } from '../src/features/safetyService';
import { ScreeningFlow, ScreeningOutcome } from '../src/features/screens/ScreeningFlow';
import { Button, H1, H2, Loading, MultiChoice, P, Screen } from '../src/ui/kit';

const KINDS: ScreeningKind[] = ['something_changed', 'periodic', 'after_gap', 'review_12w', 'anatomy_change'];

export default function ScreeningScreen() {
  const params = useLocalSearchParams<{ kind?: string; checkId?: string; parts?: string }>();
  const kind: ScreeningKind = KINDS.includes(params.kind as ScreeningKind) ? (params.kind as ScreeningKind) : 'something_changed';
  const { db, bump } = useApp();
  const { data: profile } = useLoad((d) => getProfile(d));
  const [busy, setBusy] = useState(false);
  // "Something changed?" starts with what changed (UX audit M10); null until the person continues.
  const [picked, setPicked] = useState<ChangeTopic[]>([]);
  const [topics, setTopics] = useState<ChangeTopic[] | null>(null);
  const [result, setResult] = useState<{ mode: SafetyMode; reasons: QuestionKey[]; cautions: QuestionKey[]; skipped: QuestionKey[] } | null>(null);
  if (!profile) return <Loading />;
  const title = kind === 'periodic' ? HOME.shortScreenDue : HOME.somethingChanged;
  if (result) {
    return (
      <Screen title={title} footer={<Button label={COMMON.done} onPress={() => router.back()} />}>
        <ScreeningOutcome mode={result.mode} reasons={result.reasons} cautions={result.cautions} skipped={result.skipped} anatomy={profile.anatomy ?? 'other_unspecified'} />
      </Screen>
    );
  }
  if (kind === 'something_changed' && !topics) {
    return (
      <Screen title={title} footer={<Button label={COMMON.continue} disabled={!picked.length} onPress={() => setTopics(picked)} />}>
        <H1>{title}</H1>
        <H2>{CHANGE_TOPICS.question}</H2>
        <P muted>{CHANGE_TOPICS.note}</P>
        <MultiChoice
          options={CHANGE_TOPICS.options.map((o) => ({ value: o.value as ChangeTopic, label: o.label, hint: 'hint' in o ? o.hint : undefined }))}
          values={picked}
          onChange={setPicked}
        />
      </Screen>
    );
  }
  return (
    <Screen title={title}>
      <H1>{title}</H1>
      <ScreeningFlow
        kind={kind}
        topics={topics ?? undefined}
        anatomy={profile.anatomy ?? 'other_unspecified'}
        busy={busy}
        onDone={async (a) => {
          setBusy(true);
          try {
            const r = await completeScreening(db, { kind, answers: a.answers, startedAt: a.startedAt, surgeryDate: a.surgeryDate, sourceRef: params.checkId ?? null });
            if (params.checkId && params.parts) await markPart(db, params.checkId, 'safety', params.parts.split(',') as BundlePart[]);
            setResult({ mode: r.mode, reasons: r.reasons, cautions: r.newCautions, skipped: r.skipped });
            reconcileReminders(db);
            bump();
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
