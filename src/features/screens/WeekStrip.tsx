// This week's day dots with day letters, today marked, and one count line (MOT-003, H9). Used on Today and after a session.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SESSION } from '../../content/en/exercise';
import { HOME } from '../../content/en/strings';
import type { WeekDots } from '../../domain/adherence';
import { formatShort, formatTime, isoWeekday } from '../../domain/dates';
import { Dots, P } from '../../ui/kit';
import { Text } from '../../ui/text';
import { usePointerFine } from '../../ui/layout';
import { radius, space, type, useColors } from '../../ui/theme';
import { SegRing } from './TodayVisuals';

export function WeekStrip({ week, target }: { week: WeekDots; target: number }) {
  const today = week.days.findIndex((d) => d.isToday);
  const n = week.trainedCount;
  const count = n >= target ? HOME.weekNice(target) : SESSION.weekCount(n, target);
  const spoken = `${SESSION.weekCount(n, target)}. ${week.days
    .map((d) => `${HOME.dayNames[isoWeekday(d.date) - 1]}${d.isToday ? ` (${HOME.todayMark})` : ''}: ${d.trained ? HOME.dayTrained : HOME.dayNotTrained}`)
    .join(', ')}`;
  return (
    <View style={{ gap: 8 }}>
      <Dots
        filled={week.days.map((d) => d.trained)}
        total={7}
        today={today}
        labels={week.days.map((d) => HOME.dayLetters[isoWeekday(d.date) - 1])}
        label={spoken}
      />
      <P>{count}</P>
    </View>
  );
}

/**
 * Today's week (round 2, A3): one small ring per day that fills per session, with a tick when the day's plan is done.
 * Today's letter is bold and outlined. No red, no crosses (MOT-003). With a mouse (Mac, Q3), hovering a day shows its
 * date and sessions ("Wed 7 Oct: 2 of 3 sessions"); screen readers already hear every day in the row's label.
 */
export function WeekRings({ week, sessions, dose }: { week: WeekDots; sessions: number[]; dose: number }) {
  const c = useColors();
  const fine = usePointerFine();
  const [hover, setHover] = useState<number | null>(null);
  const spoken = week.days
    .map((d, i) => HOME.daySpoken(HOME.dayNames[isoWeekday(d.date) - 1], sessions[i] ?? 0, dose, d.isToday))
    .join('. ');
  return (
    <View accessible accessibilityLabel={spoken} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {week.days.map((d, i) => {
        const n = sessions[i] ?? 0;
        const ring = (
          <>
            <Text style={[type('body-sm'), { color: d.isToday ? c.text : c.muted, fontWeight: d.isToday ? '700' : '400' }]}>
              {HOME.dayLetters[isoWeekday(d.date) - 1]}
            </Text>
            <SegRing done={n} total={dose} size={28} stroke={4} color={c.good} tick={n >= dose} />
          </>
        );
        const box = {
          alignItems: 'center' as const,
          gap: 4,
          paddingVertical: 4,
          paddingHorizontal: 2,
          minWidth: 36,
          borderRadius: radius.md,
          borderWidth: d.isToday ? 1.5 : 0,
          borderColor: c.text,
        };
        if (!fine) {
          return (
            <View key={d.date} style={box}>
              {ring}
            </View>
          );
        }
        // Hover only: not a Tab stop or a button, as the row's label already says the same for keyboard and VoiceOver.
        return (
          <Pressable
            key={d.date}
            accessible={false}
            focusable={false}
            importantForAccessibility="no"
            onHoverIn={() => setHover(i)}
            onHoverOut={() => setHover((h) => (h === i ? null : h))}
            style={[box, { backgroundColor: hover === i ? c.hover : 'transparent', zIndex: hover === i ? 2 : 0 }]}
          >
            {ring}
            {hover === i ? <DayTip text={dayHoverText(d.date, n, dose)} edge={i === 0 ? 'left' : i === week.days.length - 1 ? 'right' : null} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Wed 7 Oct: 2 of 3 sessions" (Q3 hover count). The count is the one the ring shows (capped at the day's plan, MOT-010). */
export function dayHoverText(date: string, done: number, total: number): string {
  return HOME.dayHover(formatShort(date), done, total);
}

/** A small label above the hovered day. At the row's ends it lines up with the day, so it stays inside the card. */
function DayTip({ text, edge }: { text: string; edge: 'left' | 'right' | null }) {
  const c = useColors();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: '100%',
        marginBottom: 4,
        left: edge === 'left' ? 0 : -80,
        right: edge === 'right' ? 0 : -80,
        alignItems: edge === 'left' ? 'flex-start' : edge === 'right' ? 'flex-end' : 'center',
      }}
    >
      <View style={{ paddingHorizontal: space(1), paddingVertical: space(0.5), borderRadius: radius.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.inputBorder }}>
        <Text numberOfLines={1} style={[type('body-sm'), { color: c.text }]}>
          {text}
        </Text>
      </View>
    </View>
  );
}

/** "today at 13:00", "tomorrow at 07:45" or "Monday at 07:45". */
export function whenText(at: Date, now = new Date()): string {
  const time = formatTime(at);
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(at) - day(now)) / 86400000);
  if (diff <= 0) return HOME.whenToday(time);
  if (diff === 1) return HOME.whenTomorrow(time);
  return HOME.whenDay(HOME.dayNames[(at.getDay() + 6) % 7], time);
}
