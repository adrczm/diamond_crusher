// Settings (08, 07 PRIV-010 to PRIV-013, 03 audio): everything the user can change later.
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Alert } from '../src/platform/dialog';
import { GOAL_LABEL } from '../src/content/en/exercise';
import { COMMON, DESKTOP, HOME, ONBOARDING, SETTINGS } from '../src/content/en/strings';
import { activeGoals, getProfile, setGoals, updateProfile } from '../src/data/repositories/profile';
import { getSettings, setTodayHeroSync, updateSettings, type Settings } from '../src/data/repositories/settings';
import { setLock, setLockTimeout } from '../src/data/vault';
import type { AgeBand, Anatomy, Goal } from '../src/domain/types';
import { useApp, useLoad, withoutRelock } from '../src/features/app';
import { reconcileReminders } from '../src/features/reminderService';
import { RemindersContent } from '../src/features/screens/RemindersContent';
import { SidePanel } from '../src/features/screens/SidePanel';
import { TrainingSection } from '../src/features/screens/TrainingSection';
import { auth } from '../src/platform/auth';
import { Banner, Card, Choice, Field, Label, LinkRow, Loading, MultiChoice, P, Screen, Section, Segments, ToggleRow, useContentClass } from '../src/ui/kit';
import { isWeb, useDesktop } from '../src/ui/layout';
import { setTextScale, textScale } from '../src/ui/textSize';
import { space } from '../src/ui/theme';

/** The settings column keeps the width of a medium page (960 less its padding) when the page grows for the right panel. */
const COLUMN_MAX = 960 - 2 * space(4);

export default function SettingsScreen() {
  const { db, boot, setBoot, bump, appVersion } = useApp();
  const { data, reload, error: loadError } = useLoad(async (d) => ({ settings: await getSettings(d), profile: await getProfile(d), goals: await activeGoals(d) }));
  const [nick, setNick] = useState<string | null>(null);
  const [lockAvail, setLockAvail] = useState<boolean>(true);
  const desktop = useDesktop();
  const [panel, setPanel] = useState(false);
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

  // Q3: on the widest Mac layout (c4), "Edit times" opens Reminders in a right panel beside the settings.
  const remindersPanel = panel ? (
    <SidePanel title={SETTINGS.reminders} onClose={() => setPanel(false)}>
      <RemindersContent />
    </SidePanel>
  ) : null;

  return (
    // Decision 7 (2026-09-29): on phones the tab and its page are both "More"; the desktop sidebar says Settings.
    // The page is full width on the desktop so it can tell c4; the settings column itself keeps its old width.
    <Screen title={desktop ? SETTINGS.title : DESKTOP.more} width={desktop ? 'full' : 'medium'}>
      <WithPanel panel={remindersPanel}>
        {(c4) => (
          <>
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

            {/* Sessions a day (no upper limit), reminders kept in step, targets and cues: src/features/screens/TrainingSection.tsx. */}
            <TrainingSection settings={s} profile={p} set={set} onEditTimes={c4 ? () => setPanel(true) : undefined} />

            <Section title={SETTINGS.theme} description={DESKTOP.settingsNotes.appearance}>
              <Segments label={SETTINGS.theme} options={SETTINGS.themeOptions.map((o) => ({ value: o.value as Settings['theme'], label: o.label }))} value={s.theme} onChange={(v) => set({ theme: v })} />
              {/* Round 2 A1: the Today card (Path or Rings) is kept per device unless the person syncs it. */}
              <ToggleRow
                label={HOME.heroSync}
                hint={HOME.heroSyncHint}
                value={s.today_hero_sync}
                onChange={(v) => void setTodayHeroSync(db, s, v).then(() => (bump(), reload()))}
              />
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
              {desktop ? <LinkRow label={SETTINGS.data} onPress={() => router.push('/data')} /> : null}
            </Section>

            <Section title={DESKTOP.helpAndChanges} description={DESKTOP.settingsNotes.more}>
              <LinkRow label={SETTINGS.learn} onPress={() => router.push('/library')} />
              <LinkRow label={SETTINGS.relearn} onPress={() => router.push('/learn?mode=recheck')} />
              <LinkRow label={SETTINGS.somethingChanged} onPress={() => router.push('/screening?kind=something_changed')} />
              {desktop ? <LinkRow label={SETTINGS.about} onPress={() => router.push('/about')} detail={SETTINGS.version(appVersion)} /> : null}
            </Section>
          </>
        )}
      </WithPanel>
    </Screen>
  );
}

/** The settings column (as wide as before on the desktop), with the right panel beside it at c4. Inside Screen, so it reads the page's width. */
function WithPanel({ panel, children }: { panel: ReactNode; children: (c4: boolean) => ReactNode }) {
  const desktop = useDesktop();
  const c4 = useContentClass() === 'c4';
  if (!desktop) return <>{children(false)}</>;
  // One tree whether the panel shows or not, so opening it keeps what the settings hold (the Undo note, a typed name).
  return (
    <View style={{ flexDirection: 'row', gap: space(2.5), alignItems: 'flex-start', justifyContent: 'center' }}>
      <View style={{ flex: 1, minWidth: 0, maxWidth: COLUMN_MAX, gap: space(2.5) }}>{children(c4)}</View>
      {c4 ? panel : null}
    </View>
  );
}
