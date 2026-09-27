// Settings (08, 07 PRIV-010 to PRIV-013, 03 audio): everything the user can change later.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { GOAL_LABEL } from '../src/content/en/exercise';
import { COMMON, ONBOARDING, SETTINGS } from '../src/content/en/strings';
import { activeGoals, getProfile, setGoals, updateProfile } from '../src/data/repositories/profile';
import { getSettings, updateSettings, type Settings } from '../src/data/repositories/settings';
import { setLock, setLockTimeout } from '../src/data/vault';
import type { AgeBand, Anatomy, AudioMode, Goal } from '../src/domain/types';
import { useApp, useLoad, withoutRelock } from '../src/features/app';
import { reconcileReminders } from '../src/features/reminderService';
import { auth } from '../src/platform/auth';
import { Banner, Card, Choice, Field, H2, Label, LinkRow, Loading, MultiChoice, P, Screen, Segments, Stepper, ToggleRow } from '../src/ui/kit';

export default function SettingsScreen() {
  const { db, boot, setBoot, bump, appVersion } = useApp();
  const { data, reload } = useLoad(async (d) => ({ settings: await getSettings(d), profile: await getProfile(d), goals: await activeGoals(d) }));
  const [nick, setNick] = useState<string | null>(null);
  const [lockAvail, setLockAvail] = useState<boolean>(true);
  useEffect(() => {
    auth.available().then(setLockAvail).catch(() => setLockAvail(false));
  }, []);
  if (!data) return <Loading />;
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
        onPress: async () => {
          await updateProfile(db, { anatomy: a });
          const allowed = GOAL_LABEL[a].map((g) => g.goal);
          const keep = data.goals.filter((g) => allowed.includes(g));
          await setGoals(db, keep.length ? keep : [allowed[0]]);
          bump();
          router.push('/screening?kind=anatomy_change');
        },
      },
    ]);
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
    <Screen title={SETTINGS.title}>
      <Card>
        <H2>{SETTINGS.profile}</H2>
        <Field
          label={SETTINGS.nickname}
          value={nick ?? p?.nickname ?? ''}
          maxLength={30}
          onChangeText={setNick}
          onEndEditing={async () => {
            if (nick === null) return;
            await updateProfile(db, { nickname: nick.trim() || null });
            bump();
          }}
        />
        <Label>{SETTINGS.anatomy}</Label>
        <Choice options={ONBOARDING.anatomyOptions.map((o) => ({ value: o.value as Anatomy, label: o.label }))} value={anatomy} onChange={changeAnatomy} />
        <Label>{SETTINGS.goals}</Label>
        <MultiChoice
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
      </Card>

      <Card>
        <H2>{SETTINGS.training}</H2>
        <Label>{SETTINGS.sessionsPerDay}</Label>
        <Segments
          options={[
            { value: 2, label: '2' },
            { value: 3, label: '3' },
          ]}
          value={s.sessions_per_day_target}
          onChange={(n) => set({ sessions_per_day_target: n })}
        />
        <P small muted>
          Change your reminder plan to match in Reminders.
        </P>
        <Label>{SETTINGS.weeklyTarget}</Label>
        <Stepper value={s.weekly_days_target} min={3} max={7} onChange={(n) => set({ weekly_days_target: n })} />
        <Label>{SETTINGS.maintenanceTarget}</Label>
        <Stepper
          value={s.maintenance_days_target ?? (p?.age_band === '60_74' || p?.age_band === '75_plus' ? 5 : 4)}
          min={3}
          max={7}
          onChange={(n) => set({ maintenance_days_target: n })}
        />
        <Label>{SETTINGS.weekStart}</Label>
        <Segments
          options={[
            { value: 1, label: 'Monday' },
            { value: 7, label: 'Sunday' },
          ]}
          value={s.week_start_day}
          onChange={(n) => set({ week_start_day: n })}
        />
        <Label>{SETTINGS.sound}</Label>
        <Segments options={SETTINGS.soundOptions.map((o) => ({ value: o.value as AudioMode, label: o.label }))} value={s.audio_mode} onChange={(v) => set({ audio_mode: v })} />
        <ToggleRow label={SETTINGS.vibration} value={s.vibration} onChange={(v) => set({ vibration: v })} />
        <ToggleRow label={SETTINGS.functionalCues} value={s.functional_cues_enabled} onChange={(v) => set({ functional_cues_enabled: v })} />
        <Label>{SETTINGS.theme}</Label>
        <Segments options={SETTINGS.themeOptions.map((o) => ({ value: o.value as Settings['theme'], label: o.label }))} value={s.theme} onChange={(v) => set({ theme: v })} />
      </Card>

      <Card>
        <LinkRow label={SETTINGS.reminders} onPress={() => router.push('/reminders')} />
      </Card>

      <Card>
        <H2>{SETTINGS.security}</H2>
        {lockAvail ? (
          <ToggleRow label={SETTINGS.lock} value={boot.lock_enabled} onChange={toggleLock} />
        ) : (
          <Banner text={ONBOARDING.lockUnavailable} />
        )}
        {boot.lock_enabled ? (
          <>
            <Label>{SETTINGS.lockTimeout}</Label>
            <Segments
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
      </Card>

      <Card>
        <LinkRow label={SETTINGS.learn} onPress={() => router.push('/library')} />
        <LinkRow label={SETTINGS.relearn} onPress={() => router.push('/learn?mode=recheck')} />
        <LinkRow label={SETTINGS.somethingChanged} onPress={() => router.push('/screening?kind=something_changed')} />
        <LinkRow label={SETTINGS.about} onPress={() => router.push('/about')} detail={SETTINGS.version(appVersion)} />
      </Card>
    </Screen>
  );
}
