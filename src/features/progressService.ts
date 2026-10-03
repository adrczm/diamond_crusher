// Progress tab data (06c): loads the records once and turns them into what each card shows. Rules live in
// src/domain/progress.ts; this file joins them to the stored rows and the copy.
import { EVENTS, SESSION_LOG } from '../content/en/items';
import { MODULES } from '../content/en/questionnaires';
import { LEVEL_NAME, MESSAGES, MEASURE_NAME, PROGRESS } from '../content/en/strings';
import { listResponses, listScheduledChecks, listSelfChecks } from '../data/repositories/checks';
import { listContextFlags, listEvents } from '../data/repositories/events';
import { listMilestones, listWeeklySummaries } from '../data/repositories/misc';
import { activeGoals, getProfile } from '../data/repositories/profile';
import { getProgramme, listLevelChanges } from '../data/repositories/programme';
import { listFlags } from '../data/repositories/safety';
import { listSessionLogs, listSessionsWithReps } from '../data/repositories/sessions';
import { getSettings } from '../data/repositories/settings';
import type { SqlDb } from '../data/sql';
import { groupByDate, isTrainedDay, weekDots } from '../domain/adherence';
import { nextCheckWindow } from '../domain/checkins';
import { addDays, diffDays, formatShort, toLocalDate, weekStart, type LocalDate } from '../domain/dates';
import {
  bestIndex,
  compareWithPrevious,
  ejacBlocks,
  ejacRank,
  firstTargetWeek,
  firstWords,
  lastWeekStarts,
  leakBlocks,
  mcidBand,
  monthlyAverages,
  newBestsAt,
  plateauMessage,
  rollingSeries,
  sameBelowFor,
  symptomStatus,
  weekCounts,
  weekStartsFrom,
  weeksOnTarget,
  withGaps,
  type Comparison,
  type Dated,
  type EjacBlock,
  type EjacEntry,
  type LeakBlock,
  type Range,
} from '../domain/progress';
import { isValid, overallTrend, personalBest, trend, type CheckForTrend, type Measure, type Trend } from '../domain/selfcheck';
import type { Point } from '../ui/charts';
import { forTrend } from './checkService';
import { toDay } from './trainingService';

export async function loadProgress(db: SqlDb) {
  const [settings, prog, sessions, checks, logs, events, flags, responses, changes, profile, goals, milestones, summaries, scheduled, safety] =
    await Promise.all([
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
      listMilestones(db),
      listWeeklySummaries(db),
      listScheduledChecks(db),
      listFlags(db),
    ]);
  return { settings, prog, sessions, checks, logs, events, flags, responses, changes, profile, goals, milestones, summaries, scheduled, safety };
}

export type ProgressRaw = Awaited<ReturnType<typeof loadProgress>>;

/** "14 Oct" */
export const shortDate = (d: LocalDate) => formatShort(d).slice(4);
/** "Oct" for 'YYYY-MM' */
const monthName = (key: string) => formatShort(`${key}-01`).split(' ')[2];

export const MEASURES: Measure[] = ['longest_hold', 'repeated_holds', 'quick_flicks'];
const UNIT: Record<Measure, string> = { longest_hold: ' s', repeated_holds: '', quick_flicks: '' };
export const measureText = (m: Measure, v: number | null) => (v == null ? '–' : `${v}${UNIT[m]}`);

export interface DayNote {
  from: LocalDate;
  to: LocalDate;
  text: string;
}

/** PFB-005: day notes as markers. A free-text note shows its first words; older notes fall back to their kind's name. */
export function dayNotes(flags: ProgressRaw['flags']): DayNote[] {
  return flags.map((f) => ({
    from: f.from_date,
    to: f.to_date ?? f.from_date,
    text: f.note?.trim() ? firstWords(f.note) : EVENTS.contextKinds.find((k) => k.value === f.kind)?.label ?? PROGRESS.dayNote,
  }));
}

function notesIn(notes: readonly DayNote[], from: LocalDate, to: LocalDate): string | null {
  const hits = notes.filter((n) => n.from <= to && n.to >= from).map((n) => n.text);
  return hits.length ? hits.join(', ') : null;
}

function joinNotes(...xs: (string | null | undefined)[]): string | null {
  const out = xs.filter((x): x is string => !!x);
  return out.length ? out.join('. ') : null;
}

export interface Series {
  points: Point[];
  markers: number[];
  summary: string;
  caption: string;
  table: { columns: string[]; rows: string[][] };
  target: number;
}

export interface RecordView {
  position: 'lying' | 'standing';
  checks: CheckForTrend[];
  dates: LocalDate[];
  verdict: Trend;
  latest: Record<Measure, number | null>;
  best: Record<Measure, number | null>;
}

export interface Milestone {
  date: LocalDate;
  text: string;
  kind: 'best' | 'level' | 'other';
}

export interface SexualItem {
  key: 'hardness' | 'control_0_10' | 'bother_0_10';
  max: number;
  entries: Dated[];
  comparison: Comparison;
  lowerIsBetter: boolean;
}

/** Time to ejaculation by activity type (PFB-016, EVT-031): the types with logged times, and the last 3 blocks of 4 weeks. */
export interface EjacView {
  activities: { value: string; label: string }[];
  blocks: EjacBlock[];
}

/** "3 to 5 minutes", in the words of the log form. */
export const ejacRangeText = (range: string | null) => (range ? EVENTS.timeOptions.find((o) => o.value === range)?.label ?? range : '–');

export interface ScoreSeries {
  moduleId: string;
  name: string;
  points: { date: LocalDate; score: number; rushed: boolean }[];
  range: { min: number; max: number } | null;
  higherIsBetter: boolean;
  band: { low: number; high: number } | null;
}

export function buildProgress(raw: ProgressRaw, today: LocalDate) {
  const wsd = raw.settings.week_start_day;
  const target =
    raw.prog.phase === 'maintenance' ? raw.settings.maintenance_days_target ?? raw.settings.weekly_days_target : raw.settings.weekly_days_target;
  const days = raw.sessions.map(toDay);
  const byDate = groupByDate(days);
  const trained = new Set<LocalDate>([...byDate.entries()].filter(([, list]) => isTrainedDay(list)).map(([d]) => d));
  const firstTrained = [...trained].sort()[0] ?? null;
  const start = [raw.prog.build_started_on, firstTrained].filter((x): x is LocalDate => !!x).sort()[0] ?? null;
  const thisWeek = weekStart(today, wsd);
  const firstWeek = start ? weekStart(start, wsd) : null;
  const week = weekDots(days, today, wsd);
  const notes = dayNotes(raw.flags);
  // UX audit M5: below 2 weeks of training, a chart is only an empty axis.
  const earlyDays = !firstTrained || diffDays(firstTrained, today) < 14;
  const trainingWeeks = start ? Math.floor(diffDays(start, today) / 7) : 0;
  const recent = weekCounts(trained, lastWeekStarts(thisWeek, 13), thisWeek, target, firstWeek);
  const onTarget = weeksOnTarget(recent, 12);
  const allWeeks = firstWeek ? weekCounts(trained, weekStartsFrom(firstWeek, thisWeek), thisWeek, target, firstWeek) : [];

  /** PFB-010 and the 12-month view (by month on narrow pages, 52 weekly bars from c3). */
  function consistency(range: Range, monthly: boolean): Series {
    const rangeText = PROGRESS.rangeSpoken[range];
    if (range === '12m' && monthly) {
      const months = monthlyAverages(trained, start, today, target, 12);
      const points: Point[] = months.map((m) => ({
        label: monthName(m.month),
        value: m.avg,
        current: m.current,
        onTarget: m.onTarget,
        valueText: m.avg == null ? undefined : m.avg.toFixed(1),
        note: joinNotes(
          m.avg == null ? PROGRESS.note.notStarted : m.current ? PROGRESS.note.soFar : m.onTarget ? PROGRESS.note.onTarget : null,
          notesIn(notes, m.from, addDays(`${m.month}-01`, 30))
        ),
      }));
      const now = months[months.length - 1].avg;
      return {
        points,
        markers: points.map((p, i) => (notesIn(notes, months[i].from, addDays(`${months[i].month}-01`, 30)) ? i : -1)).filter((i) => i >= 0),
        summary: PROGRESS.spoken.months(rangeText, target, now == null ? '–' : now.toFixed(1), months.filter((m) => m.onTarget && !m.current).length),
        caption: PROGRESS.captionMonths,
        table: { columns: [PROGRESS.col.month, PROGRESS.col.avg, PROGRESS.col.note], rows: points.map((p) => [p.label, p.valueText ?? '–', p.note ?? '']) },
        target,
      };
    }
    const starts = range === '12w' ? lastWeekStarts(thisWeek, 12) : range === '12m' ? lastWeekStarts(thisWeek, 52) : weekStartsFrom(firstWeek ?? thisWeek, thisWeek);
    const counts = weekCounts(trained, starts, thisWeek, target, firstWeek);
    const points: Point[] = counts.map((w) => {
      const note = notesIn(notes, w.start, addDays(w.start, 6));
      return {
        label: shortDate(w.start),
        date: w.start,
        value: w.days,
        current: w.current,
        onTarget: w.onTarget,
        note: joinNotes(w.days == null ? PROGRESS.note.notStarted : w.current ? PROGRESS.note.soFar : w.onTarget ? PROGRESS.note.onTarget : null, note),
      };
    });
    const ot = weeksOnTarget(counts, counts.length);
    return {
      points,
      markers: counts.map((w, i) => (notesIn(notes, w.start, addDays(w.start, 6)) ? i : -1)).filter((i) => i >= 0),
      summary: PROGRESS.spoken.weeks(rangeText, target, week.trainedCount, ot.on, ot.of),
      caption: PROGRESS.captionWeeks,
      table: {
        columns: [PROGRESS.col.week, PROGRESS.col.days, PROGRESS.col.note],
        rows: points.map((p) => [p.label, p.value == null ? '–' : String(p.value), p.note ?? '']),
      },
      target,
    };
  }

  // Your record (PFB-011, PFB-020).
  const complete = raw.checks.filter((c) => c.status === 'complete');
  const records: RecordView[] = (['lying', 'standing'] as const)
    .map((position) => {
      const rows = complete.filter((c) => c.position === position);
      const checks = rows.map(forTrend);
      const pick = (c: CheckForTrend, m: Measure) => (m === 'longest_hold' ? c.longestHoldS : m === 'repeated_holds' ? c.repeatedHolds : c.quickFlicks);
      const latest = {} as Record<Measure, number | null>;
      const best = {} as Record<Measure, number | null>;
      for (const m of MEASURES) {
        const vs = checks.map((c) => pick(c, m)).filter((v): v is number => v != null);
        latest[m] = vs.length ? vs[vs.length - 1] : null;
        best[m] = personalBest(checks, m);
      }
      return { position, checks, dates: rows.map((r) => r.local_date), verdict: overallTrend(checks), latest, best };
    })
    .filter((r) => r.checks.length > 0);
  const missed = raw.scheduled
    .filter((s) => (s.kind === 'monthly_check' || s.kind === 'quarterly_review') && (s.status === 'missed' || s.status === 'skipped'))
    .map((s) => s.due_on);

  /** One measure of one position over a range: gaps for missed checks, hollow flagged checks, best marked. */
  function recordSeries(r: RecordView, m: Measure, range: Range): Series & { holds?: (number | null)[]; best: number; domain: [LocalDate, LocalDate]; dayMarkers: { date: LocalDate; text: string }[] } {
    const from = range === '12w' ? addDays(today, -83) : range === '12m' ? addDays(today, -364) : r.dates[0] ?? today;
    const all = r.checks.map((c, i) => ({ date: r.dates[i], c }));
    const shown = withGaps(
      all.filter((x) => x.date >= from),
      missed.filter((d) => d >= from)
    );
    const pick = (c: CheckForTrend) => (m === 'longest_hold' ? c.longestHoldS : m === 'repeated_holds' ? c.repeatedHolds : c.quickFlicks);
    const points: Point[] = shown.map((x) => {
      if ('gap' in x) return { label: shortDate(x.date), date: x.date, value: null, note: PROGRESS.note.noCheck };
      const v = pick(x.c);
      return {
        label: shortDate(x.date),
        date: x.date,
        value: v,
        hollow: !isValid(x.c),
        valueText: measureText(m, v),
        note: joinNotes(
          !x.c.conditionsMet ? PROGRESS.note.condition : null,
          x.c.techniqueFlag ? PROGRESS.note.technique : null,
          notesIn(notes, addDays(x.date, -27), x.date)
        ),
      };
    });
    const holds = m === 'repeated_holds' ? shown.map((x) => ('gap' in x ? null : x.c.repeatedHoldLenS)) : undefined;
    // The personal best over all time, marked where it was first reached if that check is in range.
    const allBest = bestIndex(
      r.checks.map(pick),
      r.checks.map((c) => !isValid(c))
    );
    const bestId = allBest >= 0 ? r.checks[allBest].id : null;
    const best = shown.findIndex((x) => !('gap' in x) && x.c.id === bestId);
    const valuesShown = points.filter((p) => p.value != null).length;
    const lastP = [...points].reverse().find((p) => p.value != null);
    const domain: [LocalDate, LocalDate] = [range === 'all' ? r.dates[0] ?? today : from, today];
    const title = `${PROGRESS.tiles[m]}, ${r.position === 'lying' ? PROGRESS.lying : PROGRESS.standing}`;
    return {
      points,
      holds,
      best,
      domain,
      markers: [],
      dayMarkers: notes.filter((n) => n.from >= domain[0] && n.from <= today).map((n) => ({ date: n.from, text: n.text })),
      summary: valuesShown
        ? PROGRESS.spoken.line(title, PROGRESS.rangeSpoken[range], valuesShown, lastP?.valueText ?? '–', measureText(m, r.best[m]))
        : `${title}. ${PROGRESS.spoken.none}`,
      caption: PROGRESS.recordLegend,
      table: recordTable(r, from),
      target: 0,
    };
  }

  /** One table with all three measures as columns (review item 2): Date, Hold (s), In a row, Quick, Note. */
  function recordTable(r: RecordView, from: LocalDate) {
    const rows = withGaps(
      r.checks.map((c, i) => ({ date: r.dates[i], c })).filter((x) => x.date >= from),
      missed.filter((d) => d >= from)
    ).map((x) =>
      'gap' in x
        ? [shortDate(x.date), '–', '–', '–', PROGRESS.note.noCheck]
        : [
            shortDate(x.date),
            x.c.longestHoldS == null ? '–' : String(x.c.longestHoldS),
            x.c.repeatedHolds == null ? '–' : String(x.c.repeatedHolds),
            x.c.quickFlicks == null ? '–' : String(x.c.quickFlicks),
            joinNotes(!x.c.conditionsMet ? PROGRESS.note.condition : null, x.c.techniqueFlag ? PROGRESS.note.technique : null, notesIn(notes, addDays(x.date, -27), x.date)) ?? '',
          ]
    );
    return { columns: [PROGRESS.col.date, PROGRESS.col.hold, PROGRESS.col.row, PROGRESS.col.quick, PROGRESS.col.note], rows };
  }

  /** PFB-030, PFB-031, PFB-035 for one position. One message at a time; null when none applies. */
  function recordMessage(r: RecordView): string | null {
    if (!start || diffDays(start, today) < 42) return r.checks.length ? MESSAGES['PFB-030'] : null;
    for (const m of MEASURES) {
      const t = trend(r.checks, m);
      if (t.trend === 'improvement' && t.reference != null) return MESSAGES['PFB-031'](MEASURE_NAME[m], t.reference, t.latest[t.latest.length - 1]);
      if (t.trend === 'decline') {
        const n = notesIn(notes, addDays(today, -56), today);
        return MESSAGES['PFB-035'](MEASURE_NAME[m], n ?? '');
      }
    }
    const last = r.checks[r.checks.length - 1];
    if (last && newBestsAt(r.checks, last.id).length) return MESSAGES['PFB-031-pb'];
    return null;
  }

  const lying = records.find((r) => r.position === 'lying');
  const recordMsg = lying ? recordMessage(lying) : null;
  const plateau = recordMsg ? null : plateauMessage(lying?.checks ?? [], trainingWeeks, onTarget);

  // How your squeezes feel (PFB-014, PFB-024, LOG-025).
  const feelEntries: Dated[] = raw.logs.filter((l) => l.feel != null).map((l) => ({ date: l.local_date, value: l.feel as number }));
  const feel = compareWithPrevious(feelEntries, today, 6, sameBelowFor(5));
  const feelWord = (v: number | null) => (v == null ? null : SESSION_LOG.feelOptions.find((o) => o.value === Math.round(v))?.label ?? null);
  function feelSeries(range: Range): Series {
    const starts = range === '12w' ? lastWeekStarts(thisWeek, 12) : range === '12m' ? lastWeekStarts(thisWeek, 52) : weekStartsFrom(firstWeek ?? thisWeek, thisWeek);
    const at = starts.map((w) => (addDays(w, 6) < today ? addDays(w, 6) : today));
    const s = rollingSeries(feelEntries, at, 6);
    const points: Point[] = s.map((p, i) => ({
      label: shortDate(starts[i]),
      date: starts[i],
      value: p.value,
      valueText: p.value == null ? undefined : `${p.value} ${feelWord(p.value) ?? ''}`.trim(),
      note: p.value == null ? PROGRESS.note.notEnough : null,
    }));
    const lastP = [...points].reverse().find((p) => p.value != null);
    return {
      points,
      markers: [],
      summary: PROGRESS.spoken.line(PROGRESS.feel, PROGRESS.rangeSpoken[range], points.filter((p) => p.value != null).length, lastP?.valueText ?? '–', '–'),
      caption: PROGRESS.feelSub,
      table: {
        columns: [PROGRESS.col.week, PROGRESS.col.value, PROGRESS.col.entries],
        rows: points.map((p, i) => [p.label, p.valueText ?? '–', String(s[i].count)]),
      },
      target: 0,
    };
  }

  // Milestones (MOT-032, P3): personal bests, level changes, first weeks, build done. Newest first.
  const allChecks = complete.map(forTrend);
  const milestones: Milestone[] = [];
  const at = (iso: string) => toLocalDate(new Date(iso));
  for (const row of raw.milestones) {
    if (row.key.startsWith('pr:')) {
      const bests = row.ref ? newBestsAt(allChecks, row.ref) : [];
      milestones.push({
        date: at(row.reached_at),
        kind: 'best',
        text: bests.length ? PROGRESS.milestone.pr(bests.map((b) => PROGRESS.bestWhat[b.measure](b.value)).join(', ')) : PROGRESS.milestone.prGeneric,
      });
    } else if (row.key === 'first_week' || row.key === 'first_standing') {
      milestones.push({ date: at(row.reached_at), kind: 'other', text: PROGRESS.milestone[row.key] });
    }
  }
  for (const ch of raw.changes) {
    const name = LEVEL_NAME[ch.variable]?.(ch.after);
    if (!name) continue;
    if (ch.reason === 'progression') milestones.push({ date: at(ch.at), kind: 'level', text: PROGRESS.milestone.level(name) });
    else if (ch.reason === 'ceiling') milestones.push({ date: at(ch.at), kind: 'level', text: PROGRESS.milestone.ceiling(name) });
    else if (ch.reason === 'restart_after_gap') milestones.push({ date: at(ch.at), kind: 'level', text: PROGRESS.milestone.restart(name) });
  }
  const ftw = firstTargetWeek(allWeeks);
  if (ftw) milestones.push({ date: ftw, kind: 'other', text: PROGRESS.milestone.first_target_week });
  const built = raw.changes.find((ch) => ch.reason === 'to_maintenance' || ch.reason === 'keep_building');
  if (built) milestones.push({ date: at(built.at), kind: 'other', text: PROGRESS.milestone.build_done });
  milestones.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // Sexual activity items (PFB-016, PFB-024), only for the goals that use them.
  const male = raw.profile?.anatomy === 'male';
  const sexEvents = raw.events.filter((e) => e.type === 'sexual_activity');
  const itemKeys: SexualItem['key'][] = male
    ? [...(raw.goals.includes('erection') ? (['hardness'] as const) : []), ...(raw.goals.includes('ejaculatory_control') ? (['control_0_10', 'bother_0_10'] as const) : [])]
    : [];
  const sexual: SexualItem[] = itemKeys.map((key) => {
    const max = key === 'hardness' ? 4 : 10;
    const entries = sexEvents.filter((e) => e[key] != null).map((e) => ({ date: e.local_date, value: e[key] as number }));
    return { key, max, entries, comparison: compareWithPrevious(entries, today, 3, sameBelowFor(max)), lowerIsBetter: key === 'bother_0_10' };
  });
  function sexualSeries(item: SexualItem, range: Range): Series {
    const starts = range === '12w' ? lastWeekStarts(thisWeek, 12) : range === '12m' ? lastWeekStarts(thisWeek, 52) : weekStartsFrom(firstWeek ?? thisWeek, thisWeek);
    const atDates = starts.map((w) => (addDays(w, 6) < today ? addDays(w, 6) : today));
    const s = rollingSeries(item.entries, atDates, 3);
    const points: Point[] = s.map((p, i) => ({ label: shortDate(starts[i]), date: starts[i], value: p.value, note: p.value == null ? PROGRESS.note.notEnough : null }));
    const lastP = [...points].reverse().find((p) => p.value != null);
    const name = PROGRESS.sexualItems[item.key];
    return {
      points,
      markers: starts.map((w, i) => (notesIn(notes, w, addDays(w, 6)) ? i : -1)).filter((i) => i >= 0),
      summary: PROGRESS.spoken.line(name, PROGRESS.rangeSpoken[range], points.filter((p) => p.value != null).length, lastP ? String(lastP.value) : '–', '–'),
      caption: PROGRESS.sexualSub,
      table: { columns: [PROGRESS.col.week, PROGRESS.col.value, PROGRESS.col.entries], rows: points.map((p, i) => [p.label, p.value == null ? '–' : String(p.value), String(s[i].count)]) },
      target: 0,
    };
  }

  // Time to ejaculation (PFB-016, EVT-031): male profile, with the ejaculatory control goal or times already logged.
  // An entry without an activity type cannot be put with one, so it is left out.
  const ejacEntries: EjacEntry[] = male
    ? sexEvents.flatMap((e) => {
        const rank = ejacRank(e.ejac_time_band, e.ejac_time_min);
        return rank != null && e.activity_type ? [{ date: e.local_date, activity: e.activity_type, rank }] : [];
      })
    : [];
  const ejacTypes = EVENTS.activities.filter((a) => ejacEntries.some((e) => e.activity === a.value)).map((a) => ({ value: a.value, label: a.label }));
  const ejac: EjacView | null =
    male && (raw.goals.includes('ejaculatory_control') || ejacEntries.length)
      ? { activities: ejacTypes, blocks: ejacBlocks(ejacEntries, ejacTypes.map((a) => a.value), today, 3) }
      : null;

  // Other records: leaks (PFB-015), questionnaire answers (PFB-012, PFB-013), symptom check-ups (PFB-017).
  const leakEvents = raw.events.filter((e) => e.type === 'leak').map((e) => ({ date: e.local_date, situation: e.leak_situation }));
  const leaks12 = leakEvents.filter((l) => l.date > addDays(today, -84) && l.date <= today).length;
  const leakSince = [start, leakEvents[0]?.date].filter((x): x is LocalDate => !!x).sort()[0] ?? null;
  const blocks: LeakBlock[] = leakBlocks(leakEvents, today, 13, leakSince);

  const done = raw.responses.filter((r) => r.status === 'complete');
  const scores: ScoreSeries[] = MODULES.map((m) => {
    const pts = done
      .filter((r) => r.instrument_key === m.moduleId && r.total_score != null)
      .map((r) => ({ date: at(r.started_at), score: r.total_score as number, rushed: r.flags.includes('possibly_rushed') }));
    return {
      moduleId: m.moduleId,
      name: m.name,
      points: pts,
      range: m.scoring.range ?? null,
      higherIsBetter: m.scoring.direction === 'higherIsBetter',
      band: mcidBand(m.mcid, pts[0]?.score ?? null),
    };
  }).filter((s) => s.points.length > 0);
  const symptoms = symptomStatus(
    raw.responses.map((r) => ({ date: at(r.started_at), complete: r.status === 'complete' })),
    raw.safety.map((f) => ({ key: f.flag_key, date: at(f.raised_at), open: f.dismissed_at == null })),
    today
  );
  // W2: the next check as "opens …, due …".
  const nextCheck = nextCheckWindow(raw.scheduled);

  return {
    today,
    target,
    week,
    earlyDays,
    onTarget,
    consistency,
    plateau: plateau ? MESSAGES[plateau] : null,
    records,
    recordSeries,
    recordMessage,
    feel,
    feelWord,
    feelSeries,
    feelCount: feel.countCurrent,
    milestones,
    sexual,
    sexualSeries,
    ejac,
    leaks12,
    blocks,
    leakSituations: EVENTS.situations,
    responses: raw.responses,
    scores,
    symptoms,
    nextCheck,
    summaries: raw.summaries,
  };
}

export type ProgressModel = ReturnType<typeof buildProgress>;
