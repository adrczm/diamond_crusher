// Progress tab cards (round 2 Progress proposal §4, decisions P1 to P5): consistency hero, how your squeezes feel with
// milestones, one "Your record" card, sexual activity items and the Other records list. Each card holds its own range tabs
// and its coaching message (06c PFB-030 to PFB-035).
import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Polygon, Polyline } from 'react-native-svg';
import { SESSION_LOG } from '../../content/en/items';
import { HOME, PROGRESS, SUMMARY } from '../../content/en/strings';
import { addDays, formatShort, isoWeekday } from '../../domain/dates';
import type { Range } from '../../domain/progress';
import type { Measure, Trend } from '../../domain/selfcheck';
import { BarChart, ChartEmpty, ChartOrTable, DataTable, LineChart, type Column } from '../../ui/charts';
import { Button, Card, Dots, H2, Label, LinkRow, P, Tabs, useTouch, type PressState } from '../../ui/kit';
import { Text } from '../../ui/text';
import { radius, space, type, useColors } from '../../ui/theme';
import { checkLine } from '../checkService';
import { ejacRangeText, MEASURES, measureText, shortDate, type ProgressModel, type SexualItem } from '../progressService';

export type Detail =
  | { kind: 'consistency'; index?: number }
  | { kind: 'feel' }
  | { kind: 'record' }
  | { kind: 'sexual' }
  | { kind: 'leaks' }
  | { kind: 'questionnaires' }
  | { kind: 'milestones' };

/** What the cards show; lifted to the screen so the Mac's right panel shows the same series (decision M3). */
export interface ProgressView {
  consRange: Range;
  recRange: Range;
  position: 'lying' | 'standing';
  measure: Measure;
  sexItem: SexualItem['key'] | null;
  sexRange: Range;
  feelOpen: boolean;
}

export interface CardProps {
  m: ProgressModel;
  v: ProgressView;
  set: (patch: Partial<ProgressView>) => void;
  /** c4: the right panel shows details and tables, so cards drop their Chart/Table toggle (Mac 04 critique). */
  panel: boolean;
  /** 12 months as 52 weekly bars when the card is wide enough (c3 and up). */
  wide: boolean;
  detail?: Detail | null;
  onDetail: (d: Detail) => void;
}

const RANGES: { value: Range; label: string }[] = (['12w', '12m', 'all'] as Range[]).map((r) => ({ value: r, label: PROGRESS.range[r] }));

export const columnsOf = (titles: string[]): Column[] => titles.map((title, i) => ({ title, flex: i === titles.length - 1 && titles.length > 2 ? 2 : 1 }));

/** A coaching message inside the card it is about (round 2: no floating message card). */
function Message({ text }: { text: string | null }) {
  const c = useColors();
  if (!text) return null;
  return (
    <View style={{ backgroundColor: c.soft, borderRadius: radius.md, padding: space(1.5) }}>
      <Text style={[type('body-md'), { color: c.text }]}>{text}</Text>
    </View>
  );
}

function CardHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1), flexWrap: 'wrap' }}>
      <View style={{ flex: 1, minWidth: 160 }}>
        <H2>{title}</H2>
      </View>
      {right}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 1. Training consistency (hero, PFB-010, MOT-001 to MOT-005, PFB-050 row)

export function ConsistencyCard({ m, v, set, panel, wide, detail, onDetail }: CardProps) {
  const c = useColors();
  const series = m.consistency(v.consRange, !wide);
  const todayIdx = m.week.days.findIndex((d) => d.isToday);
  const lastSummary = m.summaries[0];
  return (
    <Card>
      <CardHeader title={PROGRESS.consistency} />
      <View style={{ gap: space(1) }}>
        <Label>{PROGRESS.thisWeek}</Label>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), flexWrap: 'wrap' }}>
          <Text style={[type('heading-2xl'), { color: c.text }]}>{PROGRESS.weekCount(m.week.trainedCount, m.target)}</Text>
          <Dots
            filled={m.week.days.map((d) => d.trained)}
            total={m.target}
            today={todayIdx >= 0 ? todayIdx : undefined}
            labels={m.week.days.map((d) => HOME.dayLetters[isoWeekday(d.date) - 1])}
            label={PROGRESS.weekDaysSpoken(m.week.trainedCount, m.target)}
          />
        </View>
        <P muted>{m.onTarget.of ? PROGRESS.weeksOnTarget(m.onTarget.on, m.onTarget.of) : PROGRESS.weeksOnTargetFirst}</P>
      </View>
      <Tabs options={RANGES} value={v.consRange} onChange={(r) => set({ consRange: r })} label={PROGRESS.rangeLabel(PROGRESS.consistency)} />
      {m.earlyDays ? (
        <ChartEmpty title={PROGRESS.consistencyEmptyTitle} body={PROGRESS.consistencyEmpty} />
      ) : (
        <ChartOrTable
          toggle={!panel}
          chart={
            <BarChart
              points={series.points}
              target={m.target}
              max={7}
              summary={series.summary}
              markers={series.markers}
              selected={detail?.kind === 'consistency' ? detail.index ?? null : null}
              onSelect={panel ? (i) => onDetail({ kind: 'consistency', index: i }) : undefined}
            />
          }
          table={<DataTable columns={columnsOf(series.table.columns)} rows={series.table.rows} label={PROGRESS.consistency} />}
        />
      )}
      {m.earlyDays ? null : (
        <P small muted>
          {series.markers.length ? `${series.caption} ${PROGRESS.markerLegend}` : series.caption}
        </P>
      )}
      <Message text={m.plateau} />
      <LinkRow
        label={PROGRESS.summaries}
        detail={lastSummary ? PROGRESS.summariesLast(SUMMARY.range(shortDate(lastSummary.week_start), shortDate(addDays(lastSummary.week_start, 6))), lastSummary.days_trained, lastSummary.target_days) : undefined}
        onPress={() => router.push('/summary')}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 2. How your squeezes feel (PFB-014, PFB-024, LOG-025) and milestones (MOT-032, P3)

/** Five steps from Very weak to Very strong, with the last 4 weeks (filled) and the 8 weeks before (ring). */
function FeelScale({ now, before }: { now: number; before: number | null }) {
  const c = useColors();
  const words = SESSION_LOG.feelOptions.map((o) => o.label);
  const pos = (x: number) => `${((x - 1) / 4) * 100}%` as const;
  return (
    <View
      accessible
      accessibilityLabel={PROGRESS.feelScaleSpoken(words[Math.round(now) - 1] ?? '', before == null ? null : words[Math.round(before) - 1] ?? null)}
      style={{ gap: space(1), paddingTop: space(2.5), paddingHorizontal: space(1) }}
    >
      <View style={{ height: 8, borderRadius: 4, backgroundColor: c.soft, borderWidth: 1, borderColor: c.inputBorder }}>
        {before != null ? (
          <View style={{ position: 'absolute', left: pos(before), top: -9, marginLeft: -12, width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: c.muted, backgroundColor: c.card }} />
        ) : null}
        <View style={{ position: 'absolute', left: pos(now), top: -7, marginLeft: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: c.primary, borderWidth: 2, borderColor: c.card }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {words.map((w, i) => (
          <Text key={i} style={[type('body-sm'), { color: Math.round(now) === i + 1 ? c.text : c.muted, fontWeight: Math.round(now) === i + 1 ? '600' : '400', flex: 1, textAlign: i === 0 ? 'left' : i === 4 ? 'right' : 'center' }]}>
            {w}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space(2), flexWrap: 'wrap' }}>
        <Key filled text={PROGRESS.feelNow} />
        {before != null ? <Key text={PROGRESS.feelBefore} /> : null}
      </View>
    </View>
  );
}

function Key({ filled, text }: { filled?: boolean; text: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(0.75) }}>
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: filled ? c.primary : c.card, borderWidth: filled ? 0 : 3, borderColor: c.muted }} />
      <Text style={[type('body-sm'), { color: c.muted }]}>{text}</Text>
    </View>
  );
}

function ProgressLine({ n, of }: { n: number; of: number }) {
  const c = useColors();
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: c.soft, borderWidth: 1, borderColor: c.inputBorder, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(100, (n / of) * 100)}%`, height: '100%', backgroundColor: c.primary }} />
    </View>
  );
}

function MilestoneIcon({ kind }: { kind: 'best' | 'level' | 'other' }) {
  const c = useColors();
  return (
    <Svg width={20} height={20}>
      {kind === 'best' ? (
        <Polygon points="10,1 12.6,7 19,7.4 14,11.6 15.6,18 10,14.5 4.4,18 6,11.6 1,7.4 7.4,7" fill={c.good} />
      ) : kind === 'level' ? (
        <Path d="M4 12 L10 6 L16 12 M10 6 L10 18" fill="none" stroke={c.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <Circle cx={10} cy={10} r={8} fill="none" stroke={c.good} strokeWidth={2} />
          <Polyline points="6,10 9,13 14,7" fill="none" stroke={c.good} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </Svg>
  );
}

export function MilestoneList({ items }: { items: ProgressModel['milestones'] }) {
  const c = useColors();
  if (!items.length) return <P muted>{PROGRESS.milestonesNone}</P>;
  return (
    <View style={{ gap: space(1) }}>
      {items.map((x, i) => (
        <View key={i} accessible accessibilityLabel={`${x.text}, ${formatShort(x.date)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.25) }}>
          <MilestoneIcon kind={x.kind} />
          <Text style={[type('body-md'), { color: c.text, flex: 1 }]}>{x.text}</Text>
          <Text style={[type('body-sm'), { color: c.muted }]}>{shortDate(x.date)}</Text>
        </View>
      ))}
    </View>
  );
}

export function FeelCard({ m, v, set, panel, onDetail }: CardProps) {
  const c = useColors();
  const f = m.feel;
  const word = m.feelWord(f.current);
  const series = v.feelOpen && !panel ? m.feelSeries('12w') : null;
  return (
    <Card>
      <CardHeader title={PROGRESS.feel} />
      {f.current != null && word ? (
        <View style={{ gap: space(0.75) }}>
          <Text style={[type('heading-2xl'), { color: c.text }]}>{PROGRESS.feelUsually(word)}</Text>
          {f.direction ? <P>{PROGRESS.feelCompare[f.direction]}</P> : null}
          {f.previous != null && m.feelWord(f.previous) ? <P muted>{PROGRESS.feelBeforeWas(m.feelWord(f.previous) as string)}</P> : null}
          <P small muted>
            {PROGRESS.feelFrom(f.countCurrent)}
          </P>
          <FeelScale now={f.current} before={f.previous} />
          <Button
            kind="quiet"
            label={panel ? PROGRESS.feelByWeekShow : v.feelOpen ? PROGRESS.feelByWeekHide : PROGRESS.feelByWeekShow}
            onPress={() => (panel ? onDetail({ kind: 'feel' }) : set({ feelOpen: !v.feelOpen }))}
            style={{ alignSelf: 'flex-start', paddingHorizontal: space(1), minWidth: 0 }}
          />
          {series ? (
            <ChartOrTable
              chart={<LineChart points={series.points} min={1} max={5} summary={series.summary} />}
              table={<DataTable columns={columnsOf(series.table.columns)} rows={series.table.rows} label={PROGRESS.feelByWeek} />}
            />
          ) : null}
        </View>
      ) : (
        // PFB-014, LOG-025: below 6 logged sessions in 4 weeks, progress instead of a value.
        <View style={{ gap: space(1) }} accessible accessibilityLabel={`${PROGRESS.feelProgress(f.countCurrent, 6)}. ${PROGRESS.feelProgressBody}`}>
          <Text style={[type('heading-lg'), { color: c.text }]}>{PROGRESS.feelProgress(Math.min(f.countCurrent, 6), 6)}</Text>
          <ProgressLine n={f.countCurrent} of={6} />
          <P small muted>
            {PROGRESS.feelProgressBody}
          </P>
        </View>
      )}
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />
      <Label>{PROGRESS.milestones}</Label>
      <MilestoneList items={m.milestones.slice(0, 3)} />
      {m.milestones.length > 3 ? (
        <Button
          kind="quiet"
          label={PROGRESS.showAll}
          onPress={() => (panel ? onDetail({ kind: 'milestones' }) : router.push('/records?show=milestones'))}
          style={{ alignSelf: 'flex-start', paddingHorizontal: space(1), minWidth: 0 }}
        />
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 3. Your record (PFB-011, PFB-017 tile 3, PFB-020, PFB-030/031/035, HE-03)

function VerdictIcon({ t }: { t: Trend }) {
  const c = useColors();
  const d =
    t === 'improvement' ? 'M3 9 L9 3 L15 9 M9 3 L9 16' : t === 'decline' ? 'M3 9 L9 15 L15 9 M9 15 L9 2' : t === 'steady' ? 'M2 9 L15 9 M10 4 L15 9 L10 14' : '';
  if (!d) return null;
  return (
    <Svg width={18} height={18}>
      <Path d={d} fill="none" stroke={c.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Verdict chip: an arrow and a word, not colour only (review item 11). */
function Verdict({ t }: { t: Trend }) {
  const c = useColors();
  return (
    <View
      accessible
      accessibilityLabel={PROGRESS.trendSpoken(PROGRESS.trend[t])}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space(0.5), paddingHorizontal: space(1.25), paddingVertical: space(0.5), borderRadius: 999, backgroundColor: c.soft, borderWidth: 1, borderColor: c.border }}
    >
      <VerdictIcon t={t} />
      <Text style={[type('heading-sm'), { color: c.text }]}>{PROGRESS.trend[t]}</Text>
    </View>
  );
}

/** A metric tile that picks the chart (outlined when selected). */
function Tile({ value, name, sub, extra, selected, onPress, spoken }: { value: string; name: string; sub: string; extra?: string; selected: boolean; onPress: () => void; spoken: string }) {
  const c = useColors();
  const touch = useTouch();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={spoken}
      onPress={onPress}
      style={(st) => ({
        flex: 1,
        minWidth: 96,
        minHeight: touch,
        padding: space(1.25),
        gap: space(0.25),
        borderRadius: radius.md,
        backgroundColor: (st as PressState).hovered ? c.hover : c.soft,
        borderWidth: 2,
        borderColor: selected ? c.primary : 'transparent',
        opacity: st.pressed ? 0.85 : 1,
      })}
    >
      <Text style={[type('heading-lg'), { color: c.text }]}>{value}</Text>
      <Text style={[type('body-sm'), { color: c.text }]}>{name}</Text>
      <Text style={[type('body-sm'), { color: c.muted }]}>{sub}</Text>
      {extra ? <Text style={[type('body-sm'), { color: c.muted }]}>{extra}</Text> : null}
    </Pressable>
  );
}

export function RecordCard({ m, v, set, panel, onDetail }: CardProps) {
  const r = m.records.find((x) => x.position === v.position) ?? m.records[0];
  const header = <CardHeader title={PROGRESS.yourRecord} right={r ? <Verdict t={r.verdict} /> : <Verdict t="too_early" />} />;
  if (!r) {
    return (
      <Card>
        {header}
        <ChartEmpty title={PROGRESS.recordNoneTitle} body={PROGRESS.recordNone} />
        {m.nextCheck ? <P muted>{checkLine(m.nextCheck)}</P> : null}
      </Card>
    );
  }
  const s = m.recordSeries(r, v.measure, v.recRange);
  const pick = (meas: Measure) => () => {
    set({ measure: meas });
    if (panel) onDetail({ kind: 'record' });
  };
  return (
    <Card>
      {header}
      <P small muted>
        {PROGRESS.recordSub}
      </P>
      {m.records.length > 1 ? (
        <Tabs
          options={m.records.map((x) => ({ value: x.position, label: x.position === 'lying' ? PROGRESS.lying : PROGRESS.standing }))}
          value={r.position}
          onChange={(p) => set({ position: p })}
          label={PROGRESS.positionLabel}
        />
      ) : null}
      <View accessibilityLabel={PROGRESS.measureLabel} style={{ flexDirection: 'row', gap: space(1), flexWrap: 'wrap' }}>
        {MEASURES.map((meas) => (
          <Tile
            key={meas}
            value={measureText(meas, r.latest[meas])}
            name={PROGRESS.tiles[meas]}
            sub={PROGRESS.best(measureText(meas, r.best[meas]))}
            selected={v.measure === meas}
            onPress={pick(meas)}
            spoken={PROGRESS.tileSpoken(PROGRESS.tiles[meas], measureText(meas, r.latest[meas]), measureText(meas, r.best[meas]))}
          />
        ))}
      </View>
      <Tabs options={RANGES} value={v.recRange} onChange={(x) => set({ recRange: x })} label={PROGRESS.rangeLabel(PROGRESS.yourRecord)} />
      <ChartOrTable
        toggle={!panel}
        chart={
          <LineChart
            points={s.points}
            holds={s.holds}
            best={s.best}
            domain={s.domain}
            markers={s.dayMarkers}
            max={v.measure === 'longest_hold' ? undefined : 10}
            summary={s.summary}
            onSelect={panel ? () => onDetail({ kind: 'record' }) : undefined}
          />
        }
        table={<DataTable columns={columnsOf(s.table.columns)} rows={s.table.rows} label={PROGRESS.yourRecord} />}
      />
      <P small muted>
        {[s.caption, v.measure === 'repeated_holds' ? PROGRESS.holdLengthNote : null, s.dayMarkers.length ? PROGRESS.markerLegend : null].filter(Boolean).join(' ')}
      </P>
      <Message text={m.recordMessage(r)} />
      {m.nextCheck ? <P muted>{checkLine(m.nextCheck)}</P> : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 4. Sexual activity items (PFB-016, PFB-024), same tile pattern

export function SexualCard({ m, v, set, panel, onDetail }: CardProps) {
  if (!m.sexual.length) return null;
  const item = m.sexual.find((x) => x.key === v.sexItem) ?? m.sexual[0];
  const s = m.sexualSeries(item, v.sexRange);
  return (
    <Card>
      <CardHeader title={PROGRESS.sexual} />
      <P small muted>
        {PROGRESS.sexualSub}
      </P>
      <View style={{ flexDirection: 'row', gap: space(1), flexWrap: 'wrap' }}>
        {m.sexual.map((x) => {
          const cmp = x.comparison;
          const value = cmp.current == null ? '–' : `${cmp.current} ${PROGRESS.outOf(x.max)}`;
          const sub = cmp.direction ? PROGRESS.sexualCompare[cmp.direction] : PROGRESS.sexualNotEnough;
          const name = PROGRESS.sexualItems[x.key];
          return (
            <Tile
              key={x.key}
              value={value}
              name={name}
              sub={sub}
              extra={x.lowerIsBetter ? PROGRESS.lowerIsBetter : undefined}
              selected={x.key === item.key}
              onPress={() => {
                set({ sexItem: x.key });
                if (panel) onDetail({ kind: 'sexual' });
              }}
              spoken={[name, value, sub, x.lowerIsBetter ? PROGRESS.lowerIsBetter : null].filter(Boolean).join('. ')}
            />
          );
        })}
      </View>
      <Tabs options={RANGES} value={v.sexRange} onChange={(x) => set({ sexRange: x })} label={PROGRESS.rangeLabel(PROGRESS.sexual)} />
      <ChartOrTable
        toggle={!panel}
        chart={<LineChart points={s.points} max={item.max} summary={s.summary} onSelect={panel ? () => onDetail({ kind: 'sexual' }) : undefined} />}
        table={<DataTable columns={columnsOf(s.table.columns)} rows={s.table.rows} label={PROGRESS.sexualItems[item.key]} />}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 4b. Time to ejaculation by activity type (PFB-016, EVT-031, Q3): one tile per type and a table per 4 weeks. Male profile.

export function EjacCard({ m }: CardProps) {
  const c = useColors();
  const e = m.ejac;
  if (!e) return null;
  const now = e.blocks[e.blocks.length - 1];
  return (
    <Card>
      <CardHeader title={PROGRESS.ejac} />
      <P small muted>
        {PROGRESS.ejacSub}
      </P>
      {e.activities.length ? (
        <>
          <View style={{ flexDirection: 'row', gap: space(1), flexWrap: 'wrap' }}>
            {e.activities.map((a) => {
              const cell = now.byActivity[a.value];
              const range = ejacRangeText(cell.range);
              const sub = cell.range ? PROGRESS.ejacFrom(cell.count) : PROGRESS.sexualNotEnough;
              return (
                <View
                  key={a.value}
                  accessible
                  accessibilityLabel={PROGRESS.ejacSpoken(a.label, range, sub)}
                  style={{ flex: 1, minWidth: 140, padding: space(1.25), gap: space(0.25), borderRadius: radius.md, backgroundColor: c.soft }}
                >
                  <Text style={[type('heading-md'), { color: c.text }]}>{range}</Text>
                  <Text style={[type('body-sm'), { color: c.text }]}>{a.label}</Text>
                  <Text style={[type('body-sm'), { color: c.muted }]}>{sub}</Text>
                </View>
              );
            })}
          </View>
          <Label>{PROGRESS.ejacTable}</Label>
          <DataTable
            columns={columnsOf([PROGRESS.col.weeks, ...e.activities.map((a) => a.label)])}
            rows={[...e.blocks].reverse().map((b) => [SUMMARY.range(shortDate(b.from), shortDate(b.to)), ...e.activities.map((a) => ejacRangeText(b.byActivity[a.value].range))])}
            label={PROGRESS.ejacTable}
          />
        </>
      ) : (
        <P muted>{PROGRESS.ejacNone}</P>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 5. Other records (tertiary list): leaks, questionnaire answers and symptom check-ups (PFB-017 tile 1)

export function symptomText(m: ProgressModel): string {
  if (m.symptoms.status === 'no_change' && m.symptoms.last) return PROGRESS.symptomNoChange(shortDate(m.symptoms.last));
  return PROGRESS.symptomRow[m.symptoms.status === 'changed' ? 'changed' : 'none'];
}

export function OtherRecordsCard({ m, panel, onDetail }: CardProps) {
  return (
    <Card>
      <H2>{PROGRESS.otherRecords}</H2>
      <LinkRow
        label={PROGRESS.leaks}
        detail={PROGRESS.leaksRow(m.leaks12)}
        onPress={() => (panel ? onDetail({ kind: 'leaks' }) : router.push('/records?show=leaks'))}
      />
      <LinkRow
        label={PROGRESS.questionnaires}
        detail={symptomText(m)}
        onPress={() => (panel ? onDetail({ kind: 'questionnaires' }) : router.push('/records?show=questionnaires'))}
      />
    </Card>
  );
}
