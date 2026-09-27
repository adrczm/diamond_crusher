// If-then training plan: one anchor, time and days per session slot (08 REM-001 to REM-004).
import { useState } from 'react';
import { View } from 'react-native';
import { PLAN } from '../../content/en/strings';
import { ALL_DAYS, ANCHOR_TIMES } from '../../domain/reminders';
import type { SlotPlan } from '../../data/repositories/reminders';
import { Card, Field, Label, P, Segments } from '../../ui/kit';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

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

export function PlanEditor({ plan, onChange, minutes }: { plan: SlotPlan[]; onChange: (p: SlotPlan[]) => void; minutes: number }) {
  const [editing, setEditing] = useState<number | null>(null);
  const set = (i: number, patch: Partial<SlotPlan>) => onChange(plan.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <View style={{ gap: 12 }}>
      {plan.map((p, i) => (
        <Card key={p.slotNo}>
          <Label>{`Session ${p.slotNo}`}</Label>
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
              <Field label={`${PLAN.time} (HH:MM)`} value={p.timeLocal} maxLength={5} keyboardType="numbers-and-punctuation" onChangeText={(t) => set(i, { timeLocal: t })} />
              <Label>{PLAN.days}</Label>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {PLAN.daysShort.map((d, bit) => (
                  <Segments
                    key={bit}
                    options={[{ value: true, label: d }]}
                    value={(p.weekdays & (1 << bit)) !== 0 ? true : undefined}
                    onChange={() => set(i, { weekdays: p.weekdays ^ (1 << bit) })}
                  />
                ))}
              </View>
              <Segments options={[{ value: 'done', label: 'Done' }]} value={undefined} onChange={() => setEditing(null)} />
            </View>
          ) : (
            <Segments options={[{ value: 'edit', label: `${p.timeLocal} · Change` }]} value={undefined} onChange={() => setEditing(i)} />
          )}
        </Card>
      ))}
    </View>
  );
}
