// This week's day dots with day letters, today marked, and one count line (MOT-003, H9). Used on Today and after a session.
import { View } from 'react-native';
import { SESSION } from '../../content/en/exercise';
import { HOME } from '../../content/en/strings';
import type { WeekDots } from '../../domain/adherence';
import { formatTime, isoWeekday } from '../../domain/dates';
import { Dots, P } from '../../ui/kit';
import { Text } from '../../ui/text';
import { radius, type, useColors } from '../../ui/theme';
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
 * Today's letter is bold and outlined. No red, no crosses (MOT-003).
 */
export function WeekRings({ week, sessions, dose }: { week: WeekDots; sessions: number[]; dose: number }) {
  const c = useColors();
  const spoken = week.days
    .map((d, i) => HOME.daySpoken(HOME.dayNames[isoWeekday(d.date) - 1], sessions[i] ?? 0, dose, d.isToday))
    .join('. ');
  return (
    <View accessible accessibilityLabel={spoken} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {week.days.map((d, i) => {
        const n = sessions[i] ?? 0;
        return (
          <View
            key={d.date}
            style={{
              alignItems: 'center',
              gap: 4,
              paddingVertical: 4,
              paddingHorizontal: 2,
              minWidth: 36,
              borderRadius: radius.md,
              borderWidth: d.isToday ? 1.5 : 0,
              borderColor: c.text,
            }}
          >
            <Text style={[type('body-sm'), { color: d.isToday ? c.text : c.muted, fontWeight: d.isToday ? '700' : '400' }]}>
              {HOME.dayLetters[isoWeekday(d.date) - 1]}
            </Text>
            <SegRing done={n} total={dose} size={28} stroke={4} color={c.good} tick={n >= dose} />
          </View>
        );
      })}
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
