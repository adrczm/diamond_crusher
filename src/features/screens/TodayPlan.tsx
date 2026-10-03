// "This week + Today" (round 2, A3): the week as day rings, then today's sessions on a short timeline at their reminder
// times. The next session opens up with its length, shape, parts and one Start button (M6, HE-10, MOT-001 to MOT-004).
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SESSION } from '../../content/en/exercise';
import { DESKTOP, HOME } from '../../content/en/strings';
import { atLocalTime, formatDuration, formatTime, toLocalDate } from '../../domain/dates';
import { durationS, RELAX_IN_S, type SessionPlan } from '../../domain/session/plan';
import { feedback } from '../../platform/feedback';
import { Icon } from '../../ui/icons';
import { Button, Card, Label, P, type PressState } from '../../ui/kit';
import { isWeb, useDesktop } from '../../ui/layout';
import { Text } from '../../ui/text';
import { radius, space, type, useColors } from '../../ui/theme';
import { openSessionOnce } from '../app';
import { checkLine } from '../checkService';
import type { HomeModel, TimelineSlot } from '../homeService';
import { PositionBadge, SessionShape } from './TodayVisuals';
import { WeekRings, whenText } from './WeekStrip';

/** M6: one Start. On the web, sound needs a user gesture, so the players are made inside this tap. */
export function startSession() {
  openSessionOnce(() => {
    void feedback.prepare().catch(() => undefined);
    router.push('/session?go=1');
  });
}

export function TodayPlanCard({ m }: { m: HomeModel }) {
  const c = useColors();
  const t = m.today;
  const n = m.week.trainedCount;
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space(1) }}>
        <Label>{HOME.weekTitle}</Label>
        <P small muted>
          {n >= m.weekTarget ? HOME.weekNice(m.weekTarget) : HOME.weekCount(n, m.weekTarget)}
        </P>
      </View>
      <WeekRings week={m.week} sessions={m.daySessions} dose={m.dayDose} />
      <View style={{ height: 1, backgroundColor: c.border, marginVertical: space(0.5) }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(1) }}>
        <Label>{HOME.todayLabel}</Label>
        <Pill label={HOME.remindersLink} onPress={() => router.push('/reminders')} />
      </View>
      {t.kind === 'relax' ? (
        <Button label={HOME.relaxPractice} onPress={() => router.push('/session?relax=1')} />
      ) : (
        <Timeline m={m} />
      )}
      {t.kind === 'day_done' ? <DayDone m={m} /> : null}
      {(t.kind === 'day_done' || t.kind === 'relax') && m.nextReminder ? <P small muted>{HOME.nextReminder(whenText(m.nextReminder))}</P> : null}
      {m.check && !m.check.open && m.checkWindow ? (
        <P small muted>
          {checkLine(m.checkWindow)}
        </P>
      ) : null}
    </Card>
  );
}

/** A small rounded link in a card header ("Reminders"), like the golf app's "View Calendar". */
function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={8}
      style={(st) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingHorizontal: space(1.5),
        minHeight: 32,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: c.inputBorder,
        backgroundColor: (st as PressState).hovered ? c.hover : 'transparent',
        opacity: st.pressed ? 0.7 : 1,
      })}
    >
      <Text style={[type('body-sm'), { color: c.text }]}>{label}</Text>
      <Icon name="chevron" size={14} color={c.text} />
    </Pressable>
  );
}

function Timeline({ m }: { m: HomeModel }) {
  const t = m.today;
  const day = toLocalDate(new Date());
  const timed = m.timeline.some((s) => s.time);
  const clock = (hhmm: string | null) => (hhmm ? formatTime(atLocalTime(day, hhmm)) : '');
  const rows: React.ReactNode[] = [];
  m.timeline.forEach((s, i) => {
    if (m.nowAt === i && t.kind === 'strength') rows.push(<NowLine key="now" timed={timed} />);
    rows.push(<SlotRow key={s.n} slot={s} total={m.timeline.length} time={timed ? clock(s.time) : null} plan={s.state === 'next' ? t.plan : null} />);
  });
  if (m.nowAt === m.timeline.length && t.kind === 'strength') rows.push(<NowLine key="now" timed={timed} />);
  return <View style={{ gap: space(1) }}>{rows}</View>;
}

function NowLine({ timed }: { timed: boolean }) {
  const c = useColors();
  const now = formatTime(new Date());
  // The "now" line uses the text colour, not red: red reads as a warning in a health app.
  return (
    <View accessible accessibilityLabel={HOME.nowLine(now)} style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
      {timed ? <Text style={[type('body-sm'), { color: c.text, width: 52, fontWeight: '700' }]}>{now}</Text> : null}
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.text }} />
      <View style={{ flex: 1, height: 2, backgroundColor: c.text }} />
    </View>
  );
}

function SlotRow({ slot, total, time, plan }: { slot: TimelineSlot; total: number; time: string | null; plan: SessionPlan | null }) {
  const c = useColors();
  const look = {
    done: { bg: c.goodSoft, edge: c.good },
    next: { bg: c.infoSoft, edge: c.squeeze },
    later: { bg: c.soft, edge: c.inputBorder },
  }[slot.state];
  const title = HOME.slotTitle(slot.n, total, SESSION.positionName[slot.position]);
  return (
    <View style={{ flexDirection: 'row', gap: space(1), alignItems: 'flex-start' }}>
      {time != null ? <Text style={[type('body-sm'), { color: c.muted, width: 52, paddingTop: space(1.5) }]}>{time}</Text> : null}
      <View style={{ flex: 1, backgroundColor: look.bg, borderLeftWidth: 4, borderColor: look.edge, borderRadius: radius.md, padding: space(1.5), gap: space(1.5) }}>
        <View accessible accessibilityLabel={`${title}. ${HOME.slotState[slot.state]}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
          <View style={{ flex: 1 }}>
            <Text style={[type('heading-sm'), { color: c.text }]}>{title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {slot.state === 'done' ? <Icon name="done" size={16} color={c.text} /> : null}
              <Text style={[type('body-sm'), { color: slot.state === 'later' ? c.muted : c.text }]}>{HOME.slotState[slot.state]}</Text>
            </View>
          </View>
          <PositionBadge position={slot.position} />
        </View>
        {plan ? <NextBody plan={plan} /> : null}
      </View>
    </View>
  );
}

/** The next session, opened up (HE-10): length, shape, the parts as tiles, the position, and Start. */
function NextBody({ plan }: { plan: SessionPlan }) {
  const c = useColors();
  const hint = SESSION.positionHint[plan.position] || SESSION.positionName[plan.position];
  const tiles = [
    { v: `${RELAX_IN_S} s`, l: HOME.parts.relax },
    { v: `${plan.load.N} × ${plan.load.H} s`, l: HOME.parts.holds },
    { v: `${plan.load.F}`, l: HOME.parts.flicks },
    ...(plan.load.E ? [{ v: `${plan.load.enduranceReps} × ${plan.load.E} s`, l: HOME.parts.steady }] : []),
  ];
  return (
    <View style={{ gap: space(1.5) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1), flexWrap: 'wrap' }}>
        <Text style={[type('heading-xl'), { color: c.text }]} accessibilityLabel={`${SESSION.estimated} ${formatDuration(durationS(plan))}`}>
          {formatDuration(durationS(plan))}
        </Text>
        <View style={{ flex: 1 }} />
        <View style={{ backgroundColor: c.card, borderRadius: radius.full, paddingHorizontal: space(1.5), paddingVertical: 4, maxWidth: '100%' }}>
          <Text style={[type('body-sm'), { color: c.text }]}>{hint}</Text>
        </View>
      </View>
      <SessionShape plan={plan} label={HOME.shapeSpoken(plan.load.N, plan.load.F, plan.load.E ? plan.load.enduranceReps : 0)} />
      <View style={{ flexDirection: 'row', gap: space(1) }}>
        {tiles.map((x) => (
          <View key={x.l} accessible accessibilityLabel={`${x.l}: ${x.v}`} style={{ flex: 1, backgroundColor: c.card, borderRadius: radius.md, padding: space(1), gap: 2 }}>
            <Text style={[type('heading-sm'), { color: c.text }]}>{x.v}</Text>
            <Text style={[type('body-sm'), { color: c.muted }]}>{x.l}</Text>
          </View>
        ))}
      </View>
      <Button label={HOME.startSession} onPress={startSession} />
      <KeyHint />
    </View>
  );
}

function DayDone({ m }: { m: HomeModel }) {
  const t = m.today;
  return (
    <View style={{ gap: space(1) }}>
      <P muted>{SESSION.dayDone}</P>
      <Button label={HOME.relaxPractice} kind="secondary" onPress={() => router.push('/session?relax=1')} />
      {/* MOT-010: an extra session is possible but never rewarded or counted. */}
      {t.extraAllowed ? (
        <Button label={SESSION.extraStart} kind="quiet" onPress={() => router.push('/session?extra=1')} />
      ) : (
        <P small muted>
          {SESSION.extraBlocked}
        </P>
      )}
    </View>
  );
}

/** On a Mac, a quiet reminder that S starts the session (shortcut discoverability). */
function KeyHint() {
  const desktop = useDesktop();
  if (!desktop || !isWeb) return null;
  return (
    <P small muted center>
      {DESKTOP.startKey}
    </P>
  );
}

