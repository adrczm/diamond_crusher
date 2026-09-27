// This week's day dots with day letters, today marked, and one count line (MOT-003, H9). Used on Today and after a session.
import { View } from 'react-native';
import { SESSION } from '../../content/en/exercise';
import { HOME } from '../../content/en/strings';
import type { WeekDots } from '../../domain/adherence';
import { isoWeekday } from '../../domain/dates';
import { Dots, P } from '../../ui/kit';

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

/** "today at 13:00", "tomorrow at 07:45" or "Monday at 07:45". */
export function whenText(at: Date, now = new Date()): string {
  const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(at) - day(now)) / 86400000);
  if (diff <= 0) return HOME.whenToday(time);
  if (diff === 1) return HOME.whenTomorrow(time);
  return HOME.whenDay(HOME.dayNames[(at.getDay() + 6) % 7], time);
}
