// Reminders settings (08 REM-001 to REM-024; 09 ARCH-041 to ARCH-049).
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { COMMON, PLAN, SETTINGS } from '../src/content/en/strings';
import { listReminders, listSlots, savePlan, type SlotPlan } from '../src/data/repositories/reminders';
import { getSettings, updateSettings, type Settings } from '../src/data/repositories/settings';
import { formatShort, toLocalDate } from '../src/domain/dates';
import { useApp, useLoad, withoutRelock } from '../src/features/app';
import { reconcileReminders } from '../src/features/reminderService';
import { defaultPlan, PlanEditor, planValid, resizePlan } from '../src/features/screens/PlanEditor';
import { getPermission, requestPermission, sendTest } from '../src/platform/notifications';
import { Banner, Button, Card, Field, H2, Label, Loading, P, Screen, Segments, ToggleRow } from '../src/ui/kit';

export default function RemindersScreen() {
  const { db, bump } = useApp();
  const { data, reload } = useLoad(async (d) => {
    const settings = await getSettings(d);
    const slots = await listSlots(d);
    const reminders = await listReminders(d);
    const plan: SlotPlan[] = slots.map((s) => {
      const r = reminders.find((x) => x.kind === 'session' && x.slot_no === s.slot_no);
      return { slotNo: s.slot_no, anchorKey: s.anchor_key, anchorCustom: s.anchor_custom, timeLocal: r?.time_local ?? '09:00', weekdays: r?.weekdays ?? 127, enabled: r?.enabled ?? s.active };
    });
    return { settings, plan: plan.length ? plan : defaultPlan(settings.sessions_per_day_target), perm: await getPermission().catch(() => 'undetermined' as const) };
  });
  const [plan, setPlan] = useState<SlotPlan[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tested, setTested] = useState(false);
  const [knackTime, setKnackTime] = useState<string | null>(null);
  useEffect(() => {
    if (data && !dirty) setPlan(resizePlan(data.plan, data.settings.sessions_per_day_target));
  }, [data, dirty]);
  if (!data || !plan) return <Loading />;
  const s = data.settings;
  const set = async (patch: Partial<Settings>) => {
    await updateSettings(db, patch);
    await reconcileReminders(db);
    bump();
    reload();
  };
  const paused = s.reminders_paused && (!s.reminders_paused_until || new Date(s.reminders_paused_until) > new Date());

  return (
    <Screen title={SETTINGS.reminders}>
      {data.perm !== 'granted' ? (
        <Card tone="warn">
          <P>{PLAN.remindersOff}</P>
          <Button
            label={data.perm === 'denied' ? PLAN.openSettings : PLAN.allowReminders}
            kind="secondary"
            onPress={async () => {
              if (data.perm === 'denied') await withoutRelock(() => Linking.openSettings());
              else await withoutRelock(() => requestPermission());
              await reconcileReminders(db);
              reload();
            }}
          />
        </Card>
      ) : null}
      <P small muted>
        {PLAN.mayBeLate}
      </P>

      <H2>{PLAN.title}</H2>
      <PlanEditor
        plan={plan}
        minutes={5}
        onChange={(p) => {
          setDirty(true);
          setPlan(p);
        }}
      />
      {dirty ? (
        <Button
          label={COMMON.save}
          disabled={!planValid(plan)}
          onPress={async () => {
            await savePlan(db, plan);
            await reconcileReminders(db);
            setDirty(false);
            bump();
            reload();
          }}
        />
      ) : null}

      <Card>
        <Label>{SETTINGS.lockScreen}</Label>
        <Segments
          options={SETTINGS.lockScreenOptions.map((o) => ({ value: o.value as Settings['lock_screen_mode'], label: o.label }))}
          value={s.lock_screen_mode}
          onChange={(v) => set({ lock_screen_mode: v })}
        />
      </Card>

      <Card>
        <Label>{SETTINGS.pause}</Label>
        {paused ? (
          <>
            <P>{s.reminders_paused_until ? SETTINGS.pausedUntil(formatShort(toLocalDate(new Date(s.reminders_paused_until)))) : SETTINGS.pausedIndef}</P>
            <Button label={SETTINGS.resume} kind="secondary" onPress={() => set({ reminders_paused: false, reminders_paused_until: null })} />
          </>
        ) : (
          <Segments
            options={SETTINGS.pauseOptions.map((o) => ({ value: o.days, label: o.label }))}
            value={undefined}
            onChange={(days) =>
              set({ reminders_paused: true, reminders_paused_until: days ? new Date(Date.now() + days * 86400000).toISOString() : null })
            }
          />
        )}
      </Card>

      <Card>
        <ToggleRow label={SETTINGS.knack} value={s.knack_nudge_enabled} onChange={(v) => set({ knack_nudge_enabled: v, knack_nudge_time: s.knack_nudge_time ?? '10:00' })} />
        {s.knack_nudge_enabled ? (
          <Field
            label={`${PLAN.time} (HH:MM)`}
            value={knackTime ?? s.knack_nudge_time ?? '10:00'}
            maxLength={5}
            keyboardType="numbers-and-punctuation"
            onChangeText={setKnackTime}
            onEndEditing={() => {
              if (knackTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(knackTime)) void set({ knack_nudge_time: knackTime });
            }}
          />
        ) : null}
        <ToggleRow label={SETTINGS.weeklySummaryNote} value={s.weekly_summary_notification} onChange={(v) => set({ weekly_summary_notification: v })} />
      </Card>

      {data.perm === 'granted' ? (
        <Card>
          <H2>{PLAN.testTitle}</H2>
          <P>{PLAN.testBody}</P>
          <Button
            label={PLAN.sendTest}
            kind="secondary"
            onPress={async () => {
              await sendTest();
              setTested(true);
            }}
          />
          {tested ? (
            <>
              <P muted>{PLAN.testFixTitle}</P>
              {PLAN.testFix.map((t, i) => (
                <P key={i} small>{`• ${t}`}</P>
              ))}
            </>
          ) : null}
        </Card>
      ) : null}
      {s.last_delivery_test_result === 'not_seen' ? <Banner text={PLAN.testFix[1]} /> : null}
    </Screen>
  );
}
