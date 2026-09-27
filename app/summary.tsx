// Weekly summary (06c §6, 08 MOT-005): days vs your target, the progression note, and what you logged.
import { router } from 'expo-router';
import { useEffect } from 'react';
import { COMMON, MESSAGES, SUMMARY } from '../src/content/en/strings';
import { listWeeklySummaries, markSummaryViewed } from '../src/data/repositories/misc';
import { addDays, formatShort } from '../src/domain/dates';
import { useApp, useLoad } from '../src/features/app';
import { loggedInWeek } from '../src/features/summaryService';
import { Button, Card, H1, Loading, P, Screen } from '../src/ui/kit';

export default function Summary() {
  const { db, bump } = useApp();
  const { data } = useLoad(async (d) => {
    const all = await listWeeklySummaries(d);
    const s = all[0] ?? null;
    return { s, logged: s ? await loggedInWeek(d, s.week_start) : { leaks: 0, sexual: 0 } };
  });
  const s = data?.s;
  useEffect(() => {
    if (s && !s.viewed_at) markSummaryViewed(db, s.week_start).then(bump).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.week_start]);
  if (!data) return <Loading />;
  return (
    <Screen title={SUMMARY.title} footer={<Button label={COMMON.done} onPress={() => router.back()} />}>
      {!s ? (
        <P>Your first summary appears after your first full week.</P>
      ) : (
        <>
          <H1>{`${formatShort(s.week_start)} to ${formatShort(addDays(s.week_start, 6))}`}</H1>
          <Card>
            <P>{s.days_trained >= s.target_days ? SUMMARY.days(s.days_trained, s.target_days) : SUMMARY.belowTarget(s.days_trained, s.target_days)}</P>
            <P muted>{SUMMARY.sessions(s.sessions_counted, s.sessions_planned)}</P>
          </Card>
          {s.pain_reported ? <P>{SUMMARY.pain}</P> : null}
          {s.progression_note === 'sessions' ? <P>{SUMMARY.progressionSessions}</P> : null}
          {s.progression_note === 'other' ? <P>{SUMMARY.progressionOther}</P> : null}
          {data.logged.leaks || data.logged.sexual ? <P muted>{SUMMARY.logged(data.logged.leaks, data.logged.sexual)}</P> : null}
          {s.message_id === 'neutral' ? null : s.days_trained >= s.target_days ? null : <P>{MESSAGES.neutral}</P>}
        </>
      )}
    </Screen>
  );
}
