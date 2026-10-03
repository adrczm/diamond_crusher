// If-then training plan: one anchor, time and days per session slot (08 REM-001 to REM-004).
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { COMMON, PLAN } from '../../content/en/strings';
import { HHMM } from '../../domain/clock';
import { ALL_DAYS, ANCHOR_TIMES, keepInStep, nextFreeTime } from '../../domain/reminders';
import type { SlotPlan } from '../../data/repositories/reminders';
import { Button, Card, Field, Label, P, Row, Segments, ToggleRow, type PressState } from '../../ui/kit';
import { Text } from '../../ui/text';
import { radius, type, useColors } from '../../ui/theme';
import { TimeField } from '../../ui/TimeField';

const byTime = (a: SlotPlan, b: SlotPlan) => a.timeLocal.localeCompare(b.timeLocal) || a.slotNo - b.slotNo;

/**
 * Default plan for n sessions a day, in time order: 2 = after brushing teeth and in bed; 3 adds lunch; more than 3 adds
 * times between the others (the same rule as the keep-in-step note, REM-001).
 */
export function defaultPlan(n: number): SlotPlan[] {
  const res = keepInStep([], 0, Math.max(1, n));
  const slots = res.kind === 'updated' ? res.slots : [];
  return slots
    .map((s) => ({ slotNo: s.slotNo, anchorKey: s.anchorKey, anchorCustom: null, timeLocal: s.timeLocal, weekdays: ALL_DAYS, enabled: true }))
    .sort(byTime)
    .map((s, i) => ({ ...s, slotNo: i + 1 }));
}

/**
 * The rows the Reminders screen shows: one per session a day (REM-001, round 2: any number). Reminders that are on come
 * first; then reminders that were turned off (shown off, so their time can come back); then new default rows. Reminders
 * that are on are never hidden, so there can be more rows than sessions. Rows are in time order.
 */
export function resizePlan(plan: SlotPlan[], n: number): SlotPlan[] {
  const on = plan.filter((p) => p.enabled);
  const off = plan.filter((p) => !p.enabled).sort((a, b) => a.slotNo - b.slotNo);
  const rows = [...on, ...off.slice(0, Math.max(0, n - on.length))];
  let next = Math.max(0, ...plan.map((p) => p.slotNo));
  while (rows.length < n) {
    const time = nextFreeTime(rows.filter((r) => r.enabled).map((r) => r.timeLocal));
    const anchorKey = Object.keys(ANCHOR_TIMES).find((k) => ANCHOR_TIMES[k] === time) ?? null;
    rows.push({ slotNo: ++next, anchorKey, anchorCustom: null, timeLocal: time, weekdays: ALL_DAYS, enabled: true });
  }
  return rows.sort(byTime);
}

export function planValid(plan: SlotPlan[]): boolean {
  return plan.every((p) => HHMM.test(p.timeLocal) && (p.anchorKey !== 'custom' || (p.anchorCustom ?? '').trim().length > 0) && p.weekdays > 0);
}

export function anchorLabel(p: SlotPlan): string {
  if (p.anchorKey === 'custom') return p.anchorCustom ?? '';
  return PLAN.anchors.find((a) => a.key === p.anchorKey)?.label ?? '';
}

/** Day toggles: each one is a checkbox named with the full day (UX audit M2: not a radio button). */
function DayToggles({ weekdays, onToggle }: { weekdays: number; onToggle: (bit: number) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {PLAN.daysShort.map((d, bit) => {
        const on = (weekdays & (1 << bit)) !== 0;
        return (
          <Pressable
            key={bit}
            accessibilityRole="checkbox"
            accessibilityLabel={PLAN.daysLong[bit]}
            accessibilityState={{ checked: on }}
            onPress={() => onToggle(bit)}
            style={(st) => ({
              minWidth: 44,
              minHeight: 44,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: on ? c.primary : c.inputBorder,
              backgroundColor: on ? c.primary : (st as PressState).hovered ? c.hover : c.card,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Text style={[type('heading-md'), { color: on ? c.onPrimary : c.text }]}>{d}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PlanEditor({ plan, onChange, minutes }: { plan: SlotPlan[]; onChange: (p: SlotPlan[]) => void; minutes: number }) {
  const [editing, setEditing] = useState<number | null>(null);
  const set = (i: number, patch: Partial<SlotPlan>) => onChange(plan.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <View style={{ gap: 12 }}>
      {plan.map((p, i) => (
        <Card key={p.slotNo}>
          <Label>{PLAN.sessionLabel(i + 1)}</Label>
          {/* A slot added for a 4th or later session has no daily moment yet. */}
          <P>{p.anchorKey ? PLAN.planLine(anchorLabel(p) || PLAN.anchorLabel, minutes) : PLAN.noAnchor}</P>
          {/* REM-001: a session may have no reminder. Turned off, the slot keeps its time and days. */}
          <ToggleRow label={PLAN.reminderOn} value={p.enabled} onChange={(v) => set(i, { enabled: v })} />
          {editing === i ? (
            <View style={{ gap: 10 }}>
              <Segments
                options={PLAN.anchors.map((a) => ({ value: a.key, label: a.label }))}
                value={p.anchorKey ?? undefined}
                onChange={(k) => set(i, { anchorKey: k, timeLocal: ANCHOR_TIMES[k] ?? p.timeLocal, anchorCustom: k === 'custom' ? p.anchorCustom ?? '' : null })}
              />
              {p.anchorKey === 'custom' ? (
                <Field label={PLAN.customPlaceholder} value={p.anchorCustom ?? ''} maxLength={40} onChangeText={(t) => set(i, { anchorCustom: t })} />
              ) : null}
              <TimeField label={PLAN.time} value={p.timeLocal} onChange={(t) => set(i, { timeLocal: t })} />
              <Label>{PLAN.days}</Label>
              <DayToggles weekdays={p.weekdays} onToggle={(bit) => set(i, { weekdays: p.weekdays ^ (1 << bit) })} />
              <Row>
                <Button label={COMMON.done} kind="secondary" onPress={() => setEditing(null)} />
              </Row>
            </View>
          ) : (
            <Row gap={2}>
              <P>{PLAN.timeLine(p.timeLocal)}</P>
              <Button label={PLAN.change} accessibilityLabel={PLAN.changeLabel(i + 1)} kind="secondary" onPress={() => setEditing(i)} />
            </Row>
          )}
        </Card>
      ))}
    </View>
  );
}
