// Today's top card (round 2, A1, MOT-031): the level path or the rings, each with the personal-best tiles. On phones the
// person swipes between them (Pager); on the Mac a small switch sits above. The choice is kept per device (todayHero).
import { View } from 'react-native';
import { HOME, LEVEL_NAME, MAINTENANCE, NEXT_NAME } from '../../content/en/strings';
import type { TodayHero } from '../../data/repositories/settings';
import { Card, Pager, P } from '../../ui/kit';
import { Text } from '../../ui/text';
import { space, type, useColors, radius } from '../../ui/theme';
import { STATIONS, type BestTile, type HomeModel } from '../homeService';
import { CheckBars, Pips, SegRing } from './TodayVisuals';

/** Pips are drawn up to this many good weeks; beyond it the words say it alone. */
const MAX_PIPS = 8;

/** "Next: standing sessions" (MOT-031), or the top of the programme. */
export function nextLine(m: HomeModel): string {
  if (!m.next) return '';
  if (m.next === 'top') return MAINTENANCE.topOfProgramme;
  return HOME.next(NEXT_NAME[m.next]);
}

/** The level's name: the last step taken ("5 s holds"), or the hold length before the first step (HE-09). */
export function levelNameOf(m: HomeModel): string {
  const named = m.levelName ? LEVEL_NAME[m.levelName.variable]?.(m.levelName.after) : null;
  return named ?? HOME.holdName(m.holdS);
}

export function HeroCard({ m, onChange }: { m: HomeModel; onChange: (v: TodayHero) => void }) {
  return (
    <Pager
      label={HOME.hero.label}
      value={m.hero}
      onChange={onChange}
      pages={[
        { value: 'path', label: HOME.hero.path, render: () => <PathView m={m} /> },
        { value: 'rings', label: HOME.hero.rings, render: () => <RingsView m={m} /> },
      ]}
    />
  );
}

function PathView({ m }: { m: HomeModel }) {
  const c = useColors();
  const level = HOME.levelOf(m.level, m.levelMax);
  const name = levelNameOf(m);
  const { current, goodWeeksDone, goodWeeksLeft } = m.path;
  const total = goodWeeksLeft != null ? goodWeeksDone + goodWeeksLeft : null;
  const top = current >= STATIONS.length;
  const next = nextLine(m);
  const spoken = HOME.pathSpoken(level, name, HOME.stations[STATIONS[Math.min(current, STATIONS.length - 1)]], next || HOME.pathTop);
  const part = total ? goodWeeksDone / total : 0;
  return (
    <Card>
      <View accessible accessibilityLabel={spoken} style={{ gap: space(1.5) }}>
        <View>
          <Text style={[type('heading-xl'), { color: c.text }]}>{level}</Text>
          <Text style={[type('body-md'), { color: c.muted }]}>{name}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {STATIONS.map((s, i) => {
            const done = i < current;
            const now = i === current;
            return (
              <View key={s} style={{ flexDirection: 'row', flex: i === 0 ? 0 : 1, alignItems: 'flex-start' }}>
                {i > 0 ? (
                  <View style={{ flex: 1, height: 3, marginTop: 6, marginHorizontal: -16, backgroundColor: c.inputBorder, borderRadius: 2, overflow: 'hidden' }}>
                    <View style={{ height: 3, width: `${(i <= current ? 1 : i === current + 1 ? part : 0) * 100}%`, backgroundColor: c.good }} />
                  </View>
                ) : null}
                <View style={{ width: 52, alignItems: 'center', gap: 4 }}>
                  <View
                    style={{
                      width: 15,
                      height: 15,
                      borderRadius: 8,
                      backgroundColor: done ? c.good : c.card,
                      borderWidth: now ? 3 : 2,
                      borderColor: done ? c.good : now ? c.text : c.inputBorder,
                    }}
                  />
                  <Text style={[type('body-sm'), { color: now ? c.text : c.muted, fontWeight: now ? '700' : '400', textAlign: 'center' }]} numberOfLines={1}>
                    {HOME.stations[s]}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
        {next ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1), flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <P small>{next}</P>
            </View>
            {!top && total ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
                <P small muted>
                  {HOME.goodWeeks(goodWeeksDone, total)}
                </P>
                {total <= MAX_PIPS ? <Pips done={goodWeeksDone} total={total} /> : null}
              </View>
            ) : null}
          </View>
        ) : null}
        {!top && total ? (
          <P small muted>
            {HOME.goodWeek(m.goodDaySessions)}
          </P>
        ) : null}
      </View>
      <BestTiles m={m} />
    </Card>
  );
}

function RingsView({ m }: { m: HomeModel }) {
  const c = useColors();
  const t = m.today;
  const trained = Math.min(m.week.trainedCount, m.weekTarget);
  const days = HOME.daysThisWeek(m.week.trainedCount, m.weekTarget);
  const showToday = t.slotsTotal > 0;
  const today = showToday ? HOME.sessionsToday(t.slotsDone, t.slotsTotal) : null;
  const levelLine = `${HOME.levelOf(m.level, m.levelMax)}: ${levelNameOf(m)}`;
  const next = nextLine(m);
  const size = 120;
  return (
    <Card>
      <View
        accessible
        accessibilityLabel={HOME.ringsSpoken(days, today, `${levelLine}. ${next}`)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), flexWrap: 'wrap' }}
      >
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', left: 0, top: 0 }}>
            <SegRing done={trained} total={m.weekTarget} size={size} stroke={12} color={c.good} />
          </View>
          {showToday ? (
            <View style={{ position: 'absolute', left: 18, top: 18 }}>
              <SegRing done={t.slotsDone} total={t.slotsTotal} size={size - 36} stroke={12} color={c.squeeze} />
            </View>
          ) : null}
          <Text style={[type('heading-lg'), { color: c.text }]}>{String(m.level)}</Text>
          <Text style={[type('body-sm'), { color: c.muted }]}>{HOME.levelWord}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 150, gap: space(1) }}>
          <Legend color={c.good} text={days} />
          {today ? <Legend color={c.squeeze} text={today} /> : null}
          <P small muted>
            {next ? `${levelLine}. ${next}.` : `${levelLine}.`}
          </P>
        </View>
      </View>
      <BestTiles m={m} />
    </Card>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={[type('body-md'), { color: c.text, flex: 1 }]}>{text}</Text>
    </View>
  );
}

/** Best hold and strong holds in a row from the monthly self-check (D1.5). Only rises get an arrow (MOT-020). */
function BestTiles({ m }: { m: HomeModel }) {
  const c = useColors();
  const { hold, inRow } = m.bests;
  if (hold.best == null && inRow.best == null) {
    return (
      <P small muted>
        {HOME.best.empty}
      </P>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: space(1), flexWrap: 'wrap' }}>
      <Tile
        title={HOME.best.hold}
        tile={hold}
        value={(v) => HOME.best.holdValue(v)}
        rise={(r) => HOME.best.riseHold(r)}
        chart={(vs) => HOME.best.chartHold(vs)}
        bg={c.soft}
      />
      <Tile title={HOME.best.inRow} tile={inRow} value={(v) => String(v)} rise={(r) => HOME.best.riseInRow(r)} chart={(vs) => HOME.best.chartInRow(vs)} bg={c.soft} />
    </View>
  );
}

function Tile({
  title,
  tile,
  value,
  rise,
  chart,
  bg,
}: {
  title: string;
  tile: BestTile;
  value: (v: number) => string;
  rise: (r: number) => string;
  chart: (values: string) => string;
  bg: string;
}) {
  const c = useColors();
  if (tile.best == null) return null;
  return (
    <View style={{ flex: 1, minWidth: 140, backgroundColor: bg, borderRadius: radius.md, padding: space(1.5), gap: 2 }}>
      <Text style={[type('body-sm'), { color: c.muted }]}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space(1) }}>
        <Text style={[type('heading-xl'), { color: c.text }]}>{value(tile.best)}</Text>
        <CheckBars values={tile.series} label={chart(tile.series.join(', '))} />
      </View>
      {tile.rise > 0 ? <Text style={[type('body-sm'), { color: c.text }]}>{rise(tile.rise)}</Text> : null}
    </View>
  );
}
