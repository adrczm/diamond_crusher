// Settings (08, 07 PRIV-010 to PRIV-013, 03 audio): everything the user can change later.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from '../src/platform/dialog';
import { GOAL_LABEL, VOICE } from '../src/content/en/exercise';
import { COMMON, DESKTOP, ONBOARDING, SETTINGS } from '../src/content/en/strings';
import { activeGoals, getProfile, setGoals, updateProfile } from '../src/data/repositories/profile';
import { getSettings, updateSettings, type Settings } from '../src/data/repositories/settings';
import { setLock, setLockTimeout } from '../src/data/vault';
import type { AgeBand, Anatomy, AudioMode, Goal } from '../src/domain/types';
import { useApp, useLoad, withoutRelock } from '../src/features/app';
import { reconcileReminders } from '../src/features/reminderService';
import { auth } from '../src/platform/auth';
import { feedback } from '../src/platform/feedback';
import { Banner, Button, Card, Choice, Field, Label, LinkRow, Loading, MultiChoice, P, Screen, Section, Segments, Stepper, ToggleRow } from '../src/ui/kit';
import { isWeb, useDesktop } from '../src/ui/layout';
import { setTextScale, textScale } from '../src/ui/textSize';

export default function SettingsScreen() {
  const { db, boot, setBoot, bump, appVersion } = useApp();
  const { data, reload, error: loadError } = useLoad(async (d) => ({ settings: await getSettings(d), profile: await getProfile(d), goals: await activeGoals(d) }));
  const [nick, setNick] = useState<string | null>(null);
  const [lockAvail, setLockAvail] = useState<boolean>(true);
  const desktop = useDesktop();
  useEffect(() => {
    auth.available().then(setLockAvail).catch(() => setLockAvail(false));
  }, []);
  if (!data) return <Loading error={loadError} onRetry={reload} />;
  const s = data.settings;
  const p = data.profile;
  const anatomy: Anatomy = p?.anatomy ?? 'other_unspecified';
  const set = async (patch: Partial<Settings>) => {
    await updateSettings(db, patch);
    reconcileReminders(db);
    bump();
    reload();
  };
  const changeAnatomy = (a: Anatomy) => {
    if (a === anatomy) return;
    Alert.alert(SETTINGS.anatomy, SETTINGS.anatomyChangeNote, [
      { text: COMMON.cancel, style: 'cancel' },
      {
        text: COMMON.continue,
        // The body is saved only when the safety questions are done (DS-E17), in app/screening.tsx.
        onPress: () => router.push(`/screening?kind=anatomy_change&anatomy=${a}`),
      },
    ]);
  };
  const saveNick = async () => {
    if (nick === null) return;
    await updateProfile(db, { nickname: nick.trim() || null });
    setNick(null);
    bump();
    reload();
  };
  const toggleLock = async (on: boolean) => {
    try {
      setBoot(await withoutRelock(() => setLock(db, boot, on)));
      reload();
    } catch {
      // Cancelled.
    }
  };

  return (
    <Screen title={SETTINGS.title} width="medium">
      {/* Phones: this page is the More tab, so the sections without a tab come first (the desktop has the sidebar). */}
      {!desktop ? (
        <Card>
          <LinkRow label={SETTINGS.checkIns} onPress={() => router.push('/check')} />
          <LinkRow label={SETTINGS.reminders} onPress={() => router.push('/reminders')} />
          <LinkRow label={SETTINGS.data} onPress={() => router.push('/data')} />
          <LinkRow label={SETTINGS.sync} onPress={() => router.push('/sync')} />
          <LinkRow label={SETTINGS.about} onPress={() => router.push('/about')} detail={SETTINGS.version(appVersion)} />
        </Card>
      ) : null}
      <Section title={SETTINGS.profile} description={DESKTOP.settingsNotes.profile}>
        <Field
          label={SETTINGS.nickname}
          value={nick ?? p?.nickname ?? ''}
          maxLength={30}
          onChangeText={setNick}
          // onBlur as well: the web has no onEndEditing, so the name was never saved on the Mac (DS-E14).
          onBlur={saveNick}
          onEndEditing={saveNick}
          onSubmitEditing={saveNick}
        />
        <Label>{SETTINGS.anatomy}</Label>
        <Choice label={SETTINGS.anatomy} options={ONBOARDING.anatomyOptions.map((o) => ({ value: o.value as Anatomy, label: o.label }))} value={anatomy} onChange={changeAnatomy} />
        <Label>{SETTINGS.goals}</Label>
        <MultiChoice
          label={SETTINGS.goals}
          options={GOAL_LABEL[anatomy].map((g) => ({ value: g.goal, label: g.label }))}
          values={data.goals}
          onChange={async (g: Goal[]) => {
            if (!g.length) return;
            await setGoals(db, g);
            bump();
            reload();
          }}
        />
        <Label>{SETTINGS.ageBand}</Label>
        <Choice
          options={ONBOARDING.ageOptions.map((o) => ({ value: o.value as AgeBand | null, label: o.label }))}
          value={p?.age_band ?? null}
          onChange={async (a) => {
            await updateProfile(db, { age_band: a });
            bump();
            reload();
          }}
        />
      </Section>

      <Section title={SETTINGS.training} description={DESKTOP.settingsNotes.training}>
        <Label>{SETTINGS.sessionsPerDay}</Label>
        <Segments
          label={SETTINGS.sessionsPerDay}
          options={[
            { value: 2, label: '2' },
            { value: 3, label: '3' },
          ]}
          value={s.sessions_per_day_target}
          onChange={(n) => set({ sessions_per_day_target: n })}
        />
        <P small muted>
          {SETTINGS.sessionsPerDayNote}
        </P>
        <Label>{SETTINGS.weeklyTarget}</Label>
        <Stepper label={SETTINGS.weeklyTarget} value={s.weekly_days_target} min={3} max={7} onChange={(n) => set({ weekly_days_target: n })} />
        <Label>{SETTINGS.maintenanceTarget}</Label>
        <Stepper
          label={SETTINGS.maintenanceTarget}
          value={s.maintenance_days_target ?? (p?.age_band === '60_74' || p?.age_band === '75_plus' ? 5 : 4)}
          min={3}
          max={7}
          onChange={(n) => set({ maintenance_days_target: n })}
        />
        <Label>{SETTINGS.weekStart}</Label>
        <Segments
          label={SETTINGS.weekStart}
          options={SETTINGS.weekDays}
          value={s.week_start_day}
          onChange={(n) => set({ week_start_day: n })}
        />
        <Label>{SETTINGS.sound}</Label>
        <Segments label={SETTINGS.sound} options={SETTINGS.soundOptions.map((o) => ({ value: o.value as AudioMode, label: o.label }))} value={s.audio_mode} onChange={(v) => set({ audio_mode: v })} />
        {/* Safari on a Mac cannot vibrate, so the switch is for phones only. */}
        {!isWeb ? <ToggleRow label={SETTINGS.vibration} value={s.vibration} onChange={(v) => set({ vibration: v })} /> : null}
        <Button
          kind="secondary"
          label={SETTINGS.tryCues}
          onPress={async () => {
            await feedback.prepare().catch(() => undefined);
            await feedback.cue('squeeze', { audio: s.audio_mode, vibration: s.vibration, words: VOICE.squeeze });
          }}
        />
        <ToggleRow label={SETTINGS.functionalCues} value={s.functional_cues_enabled} onChange={(v) => set({ functional_cues_enabled: v })} />
        <LinkRow label={SETTINGS.reminders} onPress={() => router.push('/reminders')} />
      </Section>

      <Section title={SETTINGS.theme} description={DESKTOP.settingsNotes.appearance}>
        <Segments label={SETTINGS.theme} options={SETTINGS.themeOptions.map((o) => ({ value: o.value as Settings['theme'], label: o.label }))} value={s.theme} onChange={(v) => set({ theme: v })} />
        {isWeb ? (
          <>
            <Label>{SETTINGS.textSize}</Label>
            <Segments label={SETTINGS.textSize} options={SETTINGS.textSizeOptions} value={textScale()} onChange={setTextScale} />
            <P small muted>
              {SETTINGS.textSizeNote}
            </P>
          </>
        ) : null}
      </Section>

      <Section title={SETTINGS.security} description={DESKTOP.settingsNotes.security}>
        {lockAvail ? (
          <ToggleRow label={SETTINGS.lock} value={boot.lock_enabled} onChange={toggleLock} />
        ) : (
          <Banner text={ONBOARDING.lockUnavailable} />
        )}
        {boot.lock_enabled ? (
          <>
            <Label>{SETTINGS.lockTimeout}</Label>
            <Segments
              label={SETTINGS.lockTimeout}
              options={SETTINGS.lockTimeoutOptions}
              value={boot.lock_timeout_s}
              onChange={async (v) => {
                setBoot(await setLockTimeout(db, boot, v));
                reload();
              }}
            />
            <P small muted>
              {ONBOARDING.lockWarning}
            </P>
          </>
        ) : null}
        <LinkRow label={SETTINGS.data} onPress={() => router.push('/data')} />
      </Section>

      <Section title={DESKTOP.more} description={DESKTOP.settingsNotes.more}>
        <LinkRow label={SETTINGS.learn} onPress={() => router.push('/library')} />
        <LinkRow label={SETTINGS.relearn} onPress={() => router.push('/learn?mode=recheck')} />
        <LinkRow label={SETTINGS.somethingChanged} onPress={() => router.push('/screening?kind=something_changed')} />
        <LinkRow label={SETTINGS.about} onPress={() => router.push('/about')} detail={SETTINGS.version(appVersion)} />
      </Section>
    </Screen>
  );
}
