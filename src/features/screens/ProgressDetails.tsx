// Progress details: logged leaks (PFB-015), questionnaire answers (PFB-012, PFB-013), all milestones (MOT-032), and the
// Mac's right panel (decision M3) that shows the selected card's detail and table without a page change.
import { View } from 'react-native';
import { MODULES } from '../../content/en/questionnaires';
import { BUNDLE, PROGRESS, SUMMARY } from '../../content/en/strings';
import { toLocalDate } from '../../domain/dates';
import { BarChart, ChartEmpty, DataTable, LineChart, type Point } from '../../ui/charts';
import { Card, H2, Label, P } from '../../ui/kit';
import { Text } from '../../ui/text';
import { radius, space, type, useColors } from '../../ui/theme';
import { shortDate, type ProgressModel } from '../progressService';
import { columnsOf, MilestoneList, symptomText, type Detail, type ProgressView } from './ProgressCards';

/** Fills for leak situations. Each also has a legend entry and a table column, so colour is never the only cue. */
function useSituationFills(): Record<string, string> {
  const c = useColors();
  return { cough_sneeze: c.primary, lifting: c.good, urge: c.link, after_urinating: c.warn, other: c.muted };
}

export function LeaksDetail({ m }: { m: ProgressModel }) {
  const c = useColors();
  const fills = useSituationFills();
  const situations = m.leakSituations;
  const nameOf = (k: string) => situations.find((s) => s.value === k)?.label ?? k;
  const total = m.blocks.reduce((a, b) => a + (b.total ?? 0), 0);
  if (!total) return <ChartEmpty title={PROGRESS.leaksEmptyTitle} body={PROGRESS.leaksEmpty} />;
  const used = situations.filter((s) => m.blocks.some((b) => (b.bySituation[s.value] ?? 0) > 0));
  const points: Point[] = m.blocks.map((b) => ({
    label: shortDate(b.from),
    date: b.from,
    value: b.total,
    stack: used.map((s) => ({ key: s.value, value: b.bySituation[s.value] ?? 0 })).filter((x) => x.value > 0),
    note: b.total == null ? PROGRESS.note.notStarted : Object.entries(b.bySituation).map(([k, n]) => PROGRESS.situationCount(n, nameOf(k).toLowerCase())).join(', ') || null,
  }));
  return (
    <View style={{ gap: space(1.5) }}>
      <P small muted>
        {PROGRESS.leaksSub}
      </P>
      <BarChart points={points} fills={fills} summary={PROGRESS.spoken.leaks(total, m.blocks.length)} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) }}>
        {used.map((s) => (
          <View key={s.value} style={{ flexDirection: 'row', alignItems: 'center', gap: space(0.75) }}>
            <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: fills[s.value] }} />
            <Text style={[type('body-sm'), { color: c.text }]}>{s.label}</Text>
          </View>
        ))}
      </View>
      <P small muted>
        {PROGRESS.leaksBlocks}
      </P>
      <DataTable
        columns={columnsOf([PROGRESS.col.weeks, PROGRESS.col.leaks, PROGRESS.col.situations])}
        rows={[...m.blocks].reverse().map((b) => [SUMMARY.range(shortDate(b.from), shortDate(b.to)), b.total == null ? '–' : String(b.total), b.total == null ? PROGRESS.note.notStarted : Object.entries(b.bySituation).map(([k, n]) => PROGRESS.situationCount(n, nameOf(k).toLowerCase())).join(', ')])}
        label={PROGRESS.leaks}
      />
    </View>
  );
}

export function QuestionnaireDetail({ m }: { m: ProgressModel }) {
  const c = useColors();
  const name = (id: string) => MODULES.find((x) => x.moduleId === id)?.name ?? id;
  const rows = [...m.responses]
    .reverse()
    .map((r) => [
      shortDate(toLocalDate(new Date(r.started_at))),
      name(r.instrument_key),
      r.total_score != null ? String(r.total_score) : '–',
      // The research label stays inside this detail only (round 2 §6).
      r.flags.includes('possibly_rushed') ? BUNDLE.rushed : '',
    ]);
  return (
    <View style={{ gap: space(1.5) }}>
      <View style={{ backgroundColor: c.soft, borderRadius: radius.md, padding: space(1.25) }}>
        <Text style={[type('body-md'), { color: c.text }]}>{symptomText(m)}</Text>
      </View>
      {m.scores.length ? (
        m.scores.map((s) => (
          <View key={s.moduleId} style={{ gap: space(1) }}>
            <Label>{PROGRESS.scoreTitle(s.name)}</Label>
            <LineChart
              points={s.points.map((p) => ({ label: shortDate(p.date), date: p.date, value: p.score, note: p.rushed ? BUNDLE.rushed : null }))}
              min={s.range?.min ?? 0}
              max={s.range?.max}
              band={s.band}
              domain={[s.points[0].date, m.today]}
              summary={PROGRESS.spoken.score(s.name, s.points.length, String(s.points[s.points.length - 1].score))}
            />
            <P small muted>
              {[s.higherIsBetter ? PROGRESS.scoreHigherBetter : PROGRESS.scoreLowerFewer, s.band ? PROGRESS.scoreBand : null].filter(Boolean).join(' ')}
            </P>
          </View>
        ))
      ) : rows.length ? (
        <P muted>{PROGRESS.scoreNone}</P>
      ) : null}
      {rows.length ? (
        <DataTable columns={columnsOf([PROGRESS.col.date, PROGRESS.col.questionnaire, PROGRESS.col.score, PROGRESS.col.note])} rows={rows} label={PROGRESS.questionnaires} />
      ) : (
        <P muted>{PROGRESS.noCheckYet}</P>
      )}
    </View>
  );
}

export function MilestonesDetail({ m }: { m: ProgressModel }) {
  return <MilestoneList items={m.milestones} />;
}

/** The Mac's right panel (~320 wide, c4): the selected card's detail and its table. */
export function DetailPanel({ m, v, detail, wide }: { m: ProgressModel; v: ProgressView; detail: Detail | null; wide: boolean }) {
  let title = PROGRESS.panelTitle;
  let body = <P muted>{PROGRESS.panelEmpty}</P>;
  if (detail?.kind === 'consistency') {
    const s = m.consistency(v.consRange, !wide);
    title = PROGRESS.consistency;
    body = <DataTable columns={columnsOf(s.table.columns)} rows={[...s.table.rows].reverse()} strong={detail.index != null ? s.table.rows.length - 1 - detail.index : null} label={title} />;
  } else if (detail?.kind === 'record') {
    const r = m.records.find((x) => x.position === v.position) ?? m.records[0];
    title = PROGRESS.yourRecord;
    if (r) {
      const s = m.recordSeries(r, v.measure, v.recRange);
      body = <DataTable columns={columnsOf(s.table.columns)} rows={[...s.table.rows].reverse()} label={title} />;
    }
  } else if (detail?.kind === 'feel') {
    const s = m.feelSeries(v.consRange);
    title = PROGRESS.feelByWeek;
    body = (
      <View style={{ gap: space(1.5) }}>
        <LineChart points={s.points} min={1} max={5} summary={s.summary} />
        <DataTable columns={columnsOf(s.table.columns)} rows={[...s.table.rows].reverse()} label={title} />
      </View>
    );
  } else if (detail?.kind === 'sexual') {
    const item = m.sexual.find((x) => x.key === v.sexItem) ?? m.sexual[0];
    if (item) {
      const s = m.sexualSeries(item, v.sexRange);
      title = PROGRESS.sexualItems[item.key];
      body = <DataTable columns={columnsOf(s.table.columns)} rows={[...s.table.rows].reverse()} label={title} />;
    }
  } else if (detail?.kind === 'leaks') {
    title = PROGRESS.leaks;
    body = <LeaksDetail m={m} />;
  } else if (detail?.kind === 'questionnaires') {
    title = PROGRESS.questionnaires;
    body = <QuestionnaireDetail m={m} />;
  } else if (detail?.kind === 'milestones') {
    title = PROGRESS.milestones;
    body = <MilestonesDetail m={m} />;
  }
  return (
    <Card>
      <H2>{title}</H2>
      {body}
    </Card>
  );
}
