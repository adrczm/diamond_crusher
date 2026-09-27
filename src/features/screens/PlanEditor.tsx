// If-then training plan: one anchor, time and days per session slot (08 REM-001 to REM-004).
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { COMMON, PLAN } from '../../content/en/strings';
import { HHMM } from '../../domain/clock';
import { ALL_DAYS, ANCHOR_TIMES } from '../../domain/reminders';
import type { SlotPlan } from '../../data/repositories/reminders';
import { Button, Card, Field, Label, P, Row, Segments, type PressState } from '../../ui/kit';
import { Text } from '../../ui/text';
import { radius, type, useColors } from '../../ui/theme';
import { TimeField } from '../../ui/TimeField';

export function defaultPlan(n: number): SlotPlan[] {
  const anchors = n >= 3 ? ['teeth', 'lunch', 'bed'] : ['teeth', 'bed'];
  return anchors.map((a, i) => ({ slotNo: i + 1, anchorKey: a, anchorCustom: null, timeLocal: ANCHOR_TIMES[a], weekdays: ALL_DAYS, enabled: true }));
}

export function resizePlan(plan: SlotPlan[], n: number): SlotPlan[] {
  if (plan.length === n) return plan;
  if (plan.length > n) return plan.slice(0, n);
  const extra = defaultPlan(n).slice(plan.length);
  return [...plan, ...extra.map((e, i) => ({ ...e, slotNo: plan.length + i + 1 }))];
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
          <Label>{PLAN.sessionLabel(p.slotNo)}</Label>
          <P>{PLAN.planLine(anchorLabel(p) || PLAN.anchorLabel, minutes)}</P>
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
              <Button label={PLAN.change} accessibilityLabel={PLAN.changeLabel(p.slotNo)} kind="secondary" onPress={() => setEditing(i)} />
            </Row>
          )}
        </Card>
      ))}
    </View>
  );
}
