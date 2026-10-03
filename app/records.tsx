// Progress details on their own page (phones and narrow windows): logged leaks, questionnaire answers, all milestones.
// On wide windows the same details open in the Progress page's right panel instead (Mac decision M3).
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { PROGRESS } from '../src/content/en/strings';
import { toLocalDate } from '../src/domain/dates';
import { useLoad } from '../src/features/app';
import { buildProgress, loadProgress } from '../src/features/progressService';
import { LeaksDetail, MilestonesDetail, QuestionnaireDetail } from '../src/features/screens/ProgressDetails';
import { Card, Loading, Screen } from '../src/ui/kit';

type Show = 'leaks' | 'questionnaires' | 'milestones';

export default function Records() {
  const { show: raw } = useLocalSearchParams<{ show?: string }>();
  const show: Show = raw === 'questionnaires' || raw === 'milestones' ? raw : 'leaks';
  const { data, reload, error } = useLoad(loadProgress);
  const today = toLocalDate(new Date());
  const m = useMemo(() => (data ? buildProgress(data, today) : null), [data, today]);
  const title = show === 'leaks' ? PROGRESS.leaks : show === 'questionnaires' ? PROGRESS.questionnaires : PROGRESS.milestones;
  if (!m) return <Loading error={error} onRetry={reload} />;
  return (
    <Screen title={title} width="medium">
      <Card>{show === 'leaks' ? <LeaksDetail m={m} /> : show === 'questionnaires' ? <QuestionnaireDetail m={m} /> : <MilestonesDetail m={m} />}</Card>
    </Screen>
  );
}
