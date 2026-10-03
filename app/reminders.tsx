// Reminders settings (08 REM-001 to REM-024; 09 ARCH-041 to ARCH-049).
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { COMMON, PLAN, SETTINGS } from '../src/content/en/strings';
import { listPlan, savePlan, type SlotPlan } from '../src/data/repositories/reminders';
import { getSettings, updateSettings, type Settings } from '../src/data/repositories/settings';
import { formatShort, toLocalDate } from '../src/domain/dates';
import { useApp, useLoad, withoutRelock } from '../src/features/app';
import { reconcileReminders } from '../src/features/reminderService';
import { defaultPlan, PlanEditor, planValid, resizePlan } from '../src/features/screens/PlanEditor';
import { getPermission, requestPermission, sendTest } from '../src/platform/notifications';
import { Banner, Button, Card, H2, Label, Loading, P, Row, Screen, Segments, ToggleRow } from '../src/ui/kit';
import { TimeField } from '../src/ui/TimeField';

export default function RemindersScreen() {
  const { db, bump } = useApp();
  const { data, reload, error: loadError } = useLoad(async (d) => {
    const settings = await getSettings(d);
    const plan = await listPlan(d);
    return {
      settings,
      plan: plan.length ? plan : defaultPlan(settings.sessions_per_day_target),
      // Rows on screen that are not stored yet (a first plan, or more sessions than slots): Save shows at once.
      stored: new Set(plan.map((p) => p.slotNo)),
      perm: await getPermission().catch(() => 'undetermined' as const),
    };
  });
  const [plan, setPlan] = useState<SlotPlan[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tested, setTested] = useState(false);
  // The knack time saves a moment after the last step, not on every tap of the stepper.
  const [knackTime, setKnackTime] = useState<string | null>(null);
  // REM-001 (round 2): one row per session a day, any number of sessions.
  useEffect(() => {
    if (data && !dirty) setPlan(resizePlan(data.plan, data.settings.sessions_per_day_target));
  }, [data, dirty]);
  const unsaved = !!plan && !!data && plan.some((p) => !data.stored.has(p.slotNo));
  useEffect(() => {
    if (!knackTime) return;
    const t = setTimeout(async () => {
      await updateSettings(db, { knack_nudge_time: knackTime });
      await reconcileReminders(db);
      bump();
      reload();
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knackTime]);
  if (!data || !plan) return <Loading error={loadError} onRetry={reload} />;
  const s = data.settings;
  const set = async (patch: Partial<Settings>) => {
    await updateSettings(db, patch);
    await reconcileReminders(db);
    bump();
    reload();
  };
  const web = Platform.OS === 'web';
  const paused = s.reminders_paused && (!s.reminders_paused_until || new Date(s.reminders_paused_until) > new Date());

  return (
    <Screen title={SETTINGS.reminders}>
      {web ? (
        // UX audit M11: a browser tab cannot wake up to remind, so say so before asking for permission.
        <Card tone="soft">
          <H2>{PLAN.webTitle}</H2>
          <P>{PLAN.webBody}</P>
          <Label>{PLAN.phoneTitle}</Label>
          <P>{PLAN.phoneBody}</P>
        </Card>
      ) : null}
      {data.perm !== 'granted' ? (
        <Card tone="warn">
          <P>{PLAN.remindersOff}</P>
          {Platform.OS === 'web' && data.perm === 'denied' ? (
            <P>{PLAN.testFix[0]}</P>
          ) : (
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
          )}
        </Card>
      ) : null}
      {web ? null : (
        <P small muted>
          {PLAN.mayBeLate}
        </P>
      )}

      <H2>{PLAN.title}</H2>
      <PlanEditor
        plan={plan}
        minutes={5}
        onChange={(p) => {
          setDirty(true);
          setPlan(p);
        }}
      />
      {dirty || unsaved ? (
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
          options={SETTINGS.lockScreenOptions.map((o) => ({
            value: o.value as Settings['lock_screen_mode'],
            label: o.label,
          }))}
          value={s.lock_screen_mode}
          onChange={(v) => set({ lock_screen_mode: v })}
        />
      </Card>

      <Card>
        <Label>{SETTINGS.pause}</Label>
        {paused ? (
          <>
            <P>
              {s.reminders_paused_until
                ? SETTINGS.pausedUntil(formatShort(toLocalDate(new Date(s.reminders_paused_until))))
                : SETTINGS.pausedIndef}
            </P>
            <Button
              label={SETTINGS.resume}
              kind="secondary"
              onPress={() => set({ reminders_paused: false, reminders_paused_until: null })}
            />
          </>
        ) : (
          // Actions, not a choice to keep (UX audit M2): buttons, not radio buttons.
          <Row>
            {SETTINGS.pauseOptions.map((o) => (
              <Button
                key={o.days}
                label={o.label}
                kind="secondary"
                onPress={() =>
                  set({
                    reminders_paused: true,
                    reminders_paused_until: o.days ? new Date(Date.now() + o.days * 86400000).toISOString() : null,
                  })
                }
              />
            ))}
          </Row>
        )}
      </Card>

      <Card>
        <ToggleRow
          label={SETTINGS.knack}
          value={s.knack_nudge_enabled}
          onChange={(v) =>
            set({
              knack_nudge_enabled: v,
              knack_nudge_time: s.knack_nudge_time ?? '10:00',
            })
          }
        />
        {s.knack_nudge_enabled ? (
          <TimeField label={PLAN.time} value={knackTime ?? s.knack_nudge_time ?? '10:00'} onChange={setKnackTime} />
        ) : null}
        <ToggleRow
          label={SETTINGS.weeklySummaryNote}
          value={s.weekly_summary_notification}
          onChange={(v) => set({ weekly_summary_notification: v })}
        />
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
