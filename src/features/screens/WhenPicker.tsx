// "When did it happen?" (06a EVT-010, EVT-020, round 2): a 7-day strip and a time-of-day slider with a Now marker.
// Every stop is a tap target, so nothing needs a drag (WCAG 2.5.7). The slider is one adjustable control: arrow keys,
// Home and End on the Mac, swipe up or down with a screen reader. With Reduce motion on, the thumb jumps.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { EVENTS } from '../../content/en/items';
import { addDays, formatShort, formatTime, isoWeekday, toLocalDate, type LocalDate } from '../../domain/dates';
import { dayInFuture, hasNow, logicalDay, nearestStop, PERIODS, periodOf, positionOf, stepStop, stops, stripDays, TRACK_END, type When } from '../../domain/when';
import { type PressState, useTouch } from '../../ui/kit';
import { useReducedMotion } from '../../ui/motion';
import { Text } from '../../ui/text';
import { motion, radius, space, type, useColors } from '../../ui/theme';

/** "Today", "Yesterday", the weekday within the last week, else "Tue 29 Sep". */
export function dayWord(day: LocalDate, now: Date): string {
  const today = toLocalDate(now);
  if (day === today) return EVENTS.today;
  if (day === addDays(today, -1)) return EVENTS.yesterday;
  if (day >= addDays(today, -6) && day < today) return EVENTS.weekdayLong[isoWeekday(day) - 1];
  return formatShort(day);
}

/** The readout line: what will be saved, in words ("Today, now (14:37)", "Yesterday, evening"). */
export function whenText(day: LocalDate, value: When, now: Date): string {
  if (value === 'now') {
    if (logicalDay(now) !== toLocalDate(now)) return EVENTS.readNowLate(formatTime(now));
    return EVENTS.readNow(dayWord(day, now), formatTime(now));
  }
  const earlier = hasNow(day, now) && periodOf(now) === value;
  return EVENTS.readPeriod(dayWord(day, now), earlier ? EVENTS.earlierWords[value] : EVENTS.periodWords[value]);
}

function dayLabel(day: LocalDate, now: Date): string {
  const [, m, d] = day.split('-').map(Number);
  const full = EVENTS.dayCell(EVENTS.weekdayLong[isoWeekday(day) - 1], d, EVENTS.monthLong[m - 1]);
  const word = dayWord(day, now);
  return word === EVENTS.today || word === EVENTS.yesterday ? `${word}, ${full}` : full;
}

/** Web key handler: ← → move, Home / End jump. */
type KeyEvent = { key?: string; nativeEvent?: { key?: string }; preventDefault?: () => void };
const keyOf = (e: KeyEvent) => e.key ?? e.nativeEvent?.key;

/** Seven days, oldest on the left, Today on the right. A radio group. */
export function DayStrip({ value, onChange, now }: { value: LocalDate; onChange: (d: LocalDate) => void; now: Date }) {
  const c = useColors();
  const days = stripDays(now);
  const move = (e: KeyEvent) => {
    const k = keyOf(e);
    const i = days.indexOf(value);
    const open = days.filter((d) => !dayInFuture(d, now));
    const j = k === 'ArrowRight' ? i + 1 : k === 'ArrowLeft' ? i - 1 : k === 'Home' ? 0 : k === 'End' ? days.indexOf(open[open.length - 1]) : null;
    if (j == null || j < 0 || j >= days.length || dayInFuture(days[j], now)) return;
    e.preventDefault?.();
    onChange(days[j]);
  };
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={EVENTS.dayStrip} style={{ flexDirection: 'row', gap: 4 }}>
      {days.map((d, i) => {
        const on = d === value;
        const future = dayInFuture(d, now);
        const today = i === days.length - 1;
        return (
          <Pressable
            key={d}
            accessibilityRole="radio"
            accessibilityLabel={dayLabel(d, now)}
            accessibilityState={{ selected: on, disabled: future }}
            disabled={future}
            onPress={() => onChange(d)}
            {...({ onKeyDown: move, tabIndex: on ? 0 : -1 } as object)}
            style={(st) => ({
              flex: 1,
              minWidth: 0,
              minHeight: 56,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: on ? c.primary : c.inputBorder,
              backgroundColor: on ? c.primary : (st as PressState).hovered ? c.hover : c.card,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              opacity: future ? 0.4 : st.pressed ? 0.85 : 1,
            })}
          >
            <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[type('body-sm'), { color: on ? c.onPrimary : c.muted }]}>
              {today ? EVENTS.today : EVENTS.weekdayShort[isoWeekday(d) - 1]}
            </Text>
            <Text maxFontSizeMultiplier={1.2} style={[type('heading-md'), { color: on ? c.onPrimary : c.text, fontVariant: ['tabular-nums'] }]}>
              {String(Number(d.slice(8)))}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Five evenly spaced stops (Morning … Night) and, on the day "now" belongs to, a Now marker at the real clock time. */
export function TimeOfDaySlider({ day, value, onChange, now }: { day: LocalDate; value: When; onChange: (v: When) => void; now: Date }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const touch = useTouch();
  const [w, setW] = useState(0);
  const list = stops(day, now);
  const withNow = hasNow(day, now);
  const nowPos = positionOf(now);
  const cur = list.find((s) => s.value === value) ?? list[list.length - 1];
  const pos = cur?.pos ?? 0;
  const x = (p: number) => (p / TRACK_END) * w;
  const left = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!w) return;
    if (reduced) left.setValue(x(pos));
    else Animated.timing(left, { toValue: x(pos), duration: motion.duration['150'], easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, w, reduced]);
  const pick = (px: number) => {
    if (!w) return;
    const v = nearestStop(day, now, Math.max(0, Math.min(1, px / w)) * TRACK_END);
    if (v != null && v !== value) onChange(v);
  };
  const onKey = (e: KeyEvent) => {
    const k = keyOf(e);
    const m = k === 'ArrowRight' || k === 'ArrowUp' ? 1 : k === 'ArrowLeft' || k === 'ArrowDown' ? -1 : k === 'Home' ? 'first' : k === 'End' ? 'last' : null;
    if (m == null) return;
    e.preventDefault?.();
    const v = stepStop(day, now, value, m);
    if (v !== value) onChange(v);
  };
  const readout = whenText(day, value, now);
  const index = Math.max(
    0,
    list.findIndex((s) => s.value === value)
  );
  const labelW = Math.min(76, w / 4.4 || 60);
  const web = Platform.OS === 'web';
  return (
    <View style={{ gap: space(0.5) }}>
      <Text style={[type('heading-md'), { color: c.text }]}>{readout}</Text>
      <View style={{ paddingHorizontal: labelW / 2 }}>
        {/* The Now marker: tap it to go back to now. */}
        <View style={{ height: 28 }}>
          {withNow && w ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={EVENTS.readNow(EVENTS.today, formatTime(now))}
              onPress={() => onChange('now')}
              hitSlop={8}
              {...({ tabIndex: -1 } as object)}
              style={{
                position: 'absolute',
                left: Math.min(x(nowPos), w) - 28,
                width: 56,
                height: 28,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={[type('body-sm'), { color: c.text, fontWeight: '700' }]}>{EVENTS.now}</Text>
            </Pressable>
          ) : null}
        </View>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={EVENTS.slider}
          accessibilityValue={{ min: 0, max: Math.max(0, list.length - 1), now: index, text: readout }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            const v = stepStop(day, now, value, e.nativeEvent.actionName === 'increment' ? 1 : -1);
            if (v !== value) onChange(v);
          }}
          {...((web ? { role: 'slider', tabIndex: 0, onKeyDown: onKey, 'aria-valuetext': readout } : {}) as object)}
          onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
          onResponderMove={(e) => pick(e.nativeEvent.locationX)}
          onResponderTerminationRequest={() => false}
          style={{ height: 36, justifyContent: 'center', borderRadius: radius.md, ...(web ? ({ cursor: 'pointer' } as object) : {}) }}
        >
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={{ position: 'absolute', left: 0, right: 0, top: 16, height: 4, borderRadius: 2, backgroundColor: c.inputBorder }} />
            {/* After Now: the rest of today has not happened yet. Hatched in the mockup; a quiet block here. */}
            {withNow && w ? (
              <View style={{ position: 'absolute', left: x(nowPos), right: 0, top: 10, height: 16, borderRadius: 4, backgroundColor: c.soft }} />
            ) : null}
            <Animated.View style={{ position: 'absolute', left: 0, top: 16, height: 4, borderRadius: 2, width: left, backgroundColor: c.primary }} />
            {PERIODS.map((_, i) => (
              <View key={i} style={{ position: 'absolute', left: x(i) - 1, top: 14, width: 2, height: 8, borderRadius: 1, backgroundColor: c.inputBorder }} />
            ))}
            {w ? (
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 6,
                  width: 24,
                  height: 24,
                  marginLeft: -12,
                  left,
                  borderRadius: 12,
                  borderWidth: 3,
                  borderColor: c.primary,
                  backgroundColor: c.card,
                }}
              />
            ) : null}
          </View>
        </View>
        {/* Stop labels: each one is a button, so a tap picks it (WCAG 2.5.7). The slider above is the keyboard control. */}
        <View style={{ height: Math.max(44, touch) }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {w
            ? PERIODS.map((p, i) => {
                const ok = list.some((s) => s.value === p);
                const on = value === p;
                return (
                  <Pressable
                    key={p}
                    disabled={!ok}
                    onPress={() => onChange(p)}
                    {...({ tabIndex: -1 } as object)}
                    style={(st) => ({
                      position: 'absolute',
                      left: x(i) - labelW / 2,
                      width: labelW,
                      minHeight: Math.max(44, touch),
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.md,
                      backgroundColor: (st as PressState).hovered && ok ? c.hover : 'transparent',
                      opacity: ok ? 1 : 0.4,
                    })}
                  >
                    <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[type('body-sm'), { color: on ? c.text : c.muted, fontWeight: on ? '700' : '400' }]}>
                      {EVENTS.periods[p]}
                    </Text>
                  </Pressable>
                );
              })
            : null}
        </View>
      </View>
    </View>
  );
}
