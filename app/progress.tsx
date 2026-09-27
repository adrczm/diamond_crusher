// Progress (06c): consistency, your self-check record, session feel, logged events and questionnaire answers.
import { useState } from 'react';
import { EVENTS } from '../src/content/en/items';
import { LEVEL_NAME, MEASURE_NAME, MESSAGES, PROGRESS } from '../src/content/en/strings';
import { listResponses, listSelfChecks } from '../src/data/repositories/checks';
import { listContextFlags, listEvents } from '../src/data/repositories/events';
import { activeGoals, getProfile } from '../src/data/repositories/profile';
import { getProgramme, listLevelChanges } from '../src/data/repositories/programme';
import { listSessionLogs, listSessionsWithReps } from '../src/data/repositories/sessions';
import { getSettings } from '../src/data/repositories/settings';
import { groupByDate, isTrainedDay } from '../src/domain/adherence';
import { addDays, diffDays, formatShort, toLocalDate, weekStart, type LocalDate } from '../src/domain/dates';
import { overallTrend, trend, isValid, type Measure } from '../src/domain/selfcheck';
import { MODULES } from '../src/content/en/questionnaires';
import { useLoad } from '../src/features/app';
import { forTrend } from '../src/features/checkService';
import { toDay } from '../src/features/trainingService';
import { ChartEmpty, ChartOrTable, type Point } from '../src/ui/charts';
import { Card, Columns, Grid, H2, Label, Loading, P, Screen, Segments } from '../src/ui/kit';

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function load(db: Parameters<typeof getSettings>[0]) {
  const [settings, prog, sessions, checks, logs, events, flags, responses, changes, profile, goals] = await Promise.all([
    getSettings(db),
    getProgramme(db),
    listSessionsWithReps(db),
    listSelfChecks(db),
    listSessionLogs(db),
    listEvents(db),
    listContextFlags(db),
    listResponses(db),
    listLevelChanges(db),
    getProfile(db),
    activeGoals(db),
  ]);
  return { settings, prog, sessions, checks, logs, events, flags, responses, changes, profile, goals };
}

export default function Progress() {
  const { data } = useLoad(load);
  const [range, setRange] = useState<'12w' | '12m'>('12w');
  if (!data) return <Loading />;
  const today = toLocalDate(new Date());
  const weeks = range === '12w' ? 12 : 52;
  const thisWeek = weekStart(today, data.settings.week_start_day);
  const weekStarts: LocalDate[] = Array.from({ length: weeks }, (_, i) => addDays(thisWeek, -7 * (weeks - 1 - i)));
  const from = weekStarts[0];
  const byDate = groupByDate(data.sessions.map(toDay));
  // UX audit M5: below 2 weeks of training, a chart of 12 weeks is only an empty axis.
  const firstTrained = [...byDate.keys()].sort()[0];
  const earlyDays = !firstTrained || diffDays(firstTrained, today) < 14;
  const target = data.prog.phase === 'maintenance' ? data.settings.maintenance_days_target ?? data.settings.weekly_days_target : data.settings.weekly_days_target;
  const consistency: Point[] = weekStarts.map((w) => {
    let n = 0;
    for (let i = 0; i < 7; i++) if (isTrainedDay(byDate.get(addDays(w, i)) ?? [])) n++;
    return { label: formatShort(w), value: n };
  });
  const complete = data.checks.filter((c) => c.status === 'complete' && c.local_date >= from);
  const lying = complete.filter((c) => c.position === 'lying');
  const standing = complete.filter((c) => c.position === 'standing');
  const lyingT = lying.map(forTrend);
  const overall = overallTrend(lyingT);
  const recordPoints = (rows: typeof lying, m: Measure): Point[] =>
    rows.map((c) => {
      const t = forTrend(c);
      const v = m === 'longest_hold' ? t.longestHoldS : m === 'repeated_holds' ? t.repeatedHolds : t.quickFlicks;
      return { label: formatShort(c.local_date), value: v, hollow: !isValid(t) };
    });
  // Header message (PFB-030 to PFB-035).
  let message: string | null = null;
  const firstCheck = data.checks[0]?.local_date;
  if (firstCheck && diffDays(firstCheck, today) < 42) message = MESSAGES['PFB-030'];
  else {
    for (const m of ['longest_hold', 'repeated_holds', 'quick_flicks'] as Measure[]) {
      const t = trend(lyingT, m);
      if (t.trend === 'improvement' && t.reference != null) {
        message = MESSAGES['PFB-031'](MEASURE_NAME[m], t.reference, t.latest[t.latest.length - 1]);
        break;
      }
      if (t.trend === 'decline') {
        const notes = data.flags
          .filter((f) => f.from_date >= addDays(today, -56))
          .map((f) => EVENTS.contextKinds.find((k) => k.value === f.kind)?.label ?? '')
          .filter(Boolean)
          .join(', ');
        message = MESSAGES['PFB-035'](MEASURE_NAME[m], notes.toLowerCase());
        break;
      }
    }
    if (!message && overall === 'steady') {
      const recentTarget = consistency.slice(-4).filter((p) => (p.value ?? 0) >= target).length;
      message = recentTarget >= 3 ? MESSAGES['PFB-033'] : MESSAGES['PFB-034'];
    }
  }
  // Session feel: weekly middle value, shown once 6 are logged.
  const feelLogs = data.logs.filter((l) => l.feel != null && l.local_date >= from);
  const feel: Point[] = weekStarts.map((w) => {
    const xs = feelLogs.filter((l) => l.local_date >= w && l.local_date <= addDays(w, 6)).map((l) => l.feel as number);
    return { label: formatShort(w), value: median(xs) };
  });
  const leaks: Point[] = weekStarts.map((w) => ({
    label: formatShort(w),
    value: data.events.filter((e) => e.type === 'leak' && e.local_date >= w && e.local_date <= addDays(w, 6)).length,
  }));
  const sex = data.events.filter((e) => e.type === 'sexual_activity' && e.local_date >= from);
  const sexItem = (key: 'hardness' | 'control_0_10' | 'bother_0_10'): Point[] =>
    weekStarts
      .filter((_, i) => i % 4 === 3 || i === weekStarts.length - 1)
      .map((w) => {
        const xs = sex.filter((e) => e.local_date > addDays(w, -21) && e.local_date <= addDays(w, 6) && e[key] != null).map((e) => e[key] as number);
        return { label: formatShort(w), value: xs.length >= 3 ? median(xs) : null };
      });
  const male = data.profile?.anatomy === 'male';
  const weekLevelChanges = data.changes.filter((c) => c.reason === 'progression' || c.reason === 'ceiling' || c.reason === 'restart_after_gap').slice(-8).reverse();

  return (
    <Screen title={PROGRESS.title} width="wide">
      <Segments
        options={[
          { value: '12w' as const, label: PROGRESS.range['12w'] },
          { value: '12m' as const, label: PROGRESS.range['12m'] },
        ]}
        value={range}
        onChange={setRange}
      />
      {message ? (
        <Card tone="soft">
          <P>{message}</P>
        </Card>
      ) : null}
      <Columns>
        <Card>
          <Label>{PROGRESS.trainingWeek}</Label>
          <P>{`${consistency[consistency.length - 1].value} of ${target} days`}</P>
        </Card>
        <Card>
          <Label>{PROGRESS.yourRecord}</Label>
          <P>{PROGRESS.trend[overall]}</P>
        </Card>
      </Columns>

      <Grid>

      <Card>
        <H2>{PROGRESS.consistency}</H2>
        <P small muted>
          {PROGRESS.consistencySub}
        </P>
        {earlyDays ? (
          <ChartEmpty title={PROGRESS.consistencyEmptyTitle} body={PROGRESS.consistencyEmpty} />
        ) : (
          <ChartOrTable kind="bar" points={consistency} target={target} max={7} label={PROGRESS.consistency} tableLabel={PROGRESS.table} chartLabel={PROGRESS.chart} />
        )}
      </Card>

      <Card>
        <H2>{PROGRESS.recordChart}</H2>
        <P small muted>
          {PROGRESS.recordSub}
        </P>
        {lying.length === 0 ? <P muted>{PROGRESS.noData}</P> : null}
        {([['lying', lying], ['standing', standing]] as const).map(([pos, rows]) =>
          rows.length ? (
            <Card key={pos}>
              <Label>{pos === 'lying' ? PROGRESS.lying : PROGRESS.standing}</Label>
              <P>{PROGRESS.longest}</P>
              <ChartOrTable kind="line" points={recordPoints(rows, 'longest_hold')} unit=" s" label={PROGRESS.longest} tableLabel={PROGRESS.table} chartLabel={PROGRESS.chart} />
              <P>{PROGRESS.repeated}</P>
              <ChartOrTable kind="line" max={10} points={recordPoints(rows, 'repeated_holds')} label={PROGRESS.repeated} tableLabel={PROGRESS.table} chartLabel={PROGRESS.chart} />
              <P>{PROGRESS.quick}</P>
              <ChartOrTable kind="line" max={10} points={recordPoints(rows, 'quick_flicks')} label={PROGRESS.quick} tableLabel={PROGRESS.table} chartLabel={PROGRESS.chart} />
            </Card>
          ) : null
        )}
        <P small muted>
          {PROGRESS.hollowNote}
        </P>
      </Card>

      <Card>
        <H2>{PROGRESS.feel}</H2>
        <P small muted>
          {PROGRESS.feelSub}
        </P>
        {feelLogs.length >= 6 ? (
          <ChartOrTable kind="line" max={5} points={feel} label={PROGRESS.feel} tableLabel={PROGRESS.table} chartLabel={PROGRESS.chart} />
        ) : (
          <P muted>{PROGRESS.noData}</P>
        )}
      </Card>

      <Card>
        <H2>{PROGRESS.leaks}</H2>
        <P small muted>
          {PROGRESS.leaksSub}
        </P>
        {leaks.some((p) => (p.value ?? 0) > 0) ? (
          <ChartOrTable kind="bar" points={leaks} label={PROGRESS.leaks} tableLabel={PROGRESS.table} chartLabel={PROGRESS.chart} />
        ) : (
          <ChartEmpty title={PROGRESS.leaksEmptyTitle} body={PROGRESS.leaksEmpty} />
        )}
      </Card>

      {male && (data.goals.includes('erection') || data.goals.includes('ejaculatory_control')) ? (
        <Card>
          <H2>{PROGRESS.sexual}</H2>
          <P small muted>
            {PROGRESS.sexualSub}
          </P>
          {sex.length < 3 ? <P muted>{PROGRESS.noData}</P> : null}
          {sex.length >= 3 && data.goals.includes('erection') ? (
            <>
              <P>{PROGRESS.firmness}</P>
              <ChartOrTable kind="line" max={4} points={sexItem('hardness')} label={PROGRESS.firmness} tableLabel={PROGRESS.table} chartLabel={PROGRESS.chart} />
            </>
          ) : null}
          {sex.length >= 3 && data.goals.includes('ejaculatory_control') ? (
            <>
              <P>{PROGRESS.control}</P>
              <ChartOrTable kind="line" max={10} points={sexItem('control_0_10')} label={PROGRESS.control} tableLabel={PROGRESS.table} chartLabel={PROGRESS.chart} />
              <P>{PROGRESS.bother}</P>
              <ChartOrTable kind="line" max={10} points={sexItem('bother_0_10')} label={PROGRESS.bother} tableLabel={PROGRESS.table} chartLabel={PROGRESS.chart} />
            </>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <H2>{PROGRESS.questionnaires}</H2>
        {data.responses.length === 0 ? <P muted>{PROGRESS.noCheckYet}</P> : null}
        {data.responses
          .slice(-8)
          .reverse()
          .map((r) => (
            <P key={r.id}>
              {`${formatShort(toLocalDate(new Date(r.started_at)))} · ${MODULES.find((m) => m.moduleId === r.instrument_key)?.name ?? r.instrument_key}${
                r.total_score != null ? ` · ${r.total_score}` : ''
              }${r.flags.includes('possibly_rushed') ? ' · answered quickly' : ''}`}
            </P>
          ))}
      </Card>

      <Card>
        <H2>{PROGRESS.history}</H2>
        {weekLevelChanges.length === 0 ? <P muted>{PROGRESS.noData}</P> : null}
        {weekLevelChanges.map((c) => (
          <P key={c.id}>{`${formatShort(toLocalDate(new Date(c.at)))} · ${LEVEL_NAME[c.variable]?.(c.after) ?? c.variable}`}</P>
        ))}
      </Card>
      </Grid>
    </Screen>
  );
}
