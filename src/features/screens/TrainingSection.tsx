// More > Training (Settings > Training on the Mac): sessions a day with no upper limit, and reminders that keep in
// step with Undo (round 2 decisions of 2026-10-03; 03 ENG-003, ENG-030, ENG-031; 04 PRG-040; 08 REM-001).
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { VOICE } from '../../content/en/exercise';
import { DESKTOP, SETTINGS } from '../../content/en/strings';
import { getProgramme } from '../../data/repositories/programme';
import type { ProfileRow as Profile } from '../../data/repositories/profile';
import type { Settings } from '../../data/repositories/settings';
import { formatShort, toLocalDate } from '../../domain/dates';
import type { AudioMode } from '../../domain/types';
import { feedback } from '../../platform/feedback';
import { Button, Card, Label, LinkRow, P, Row, Section, Segments, Stepper, ToggleRow } from '../../ui/kit';
import { isWeb, useDesktop } from '../../ui/layout';
import { useApp, useLoad } from '../app';
import { setSessionsPerDay, undoSessionsChange, type SessionsChange } from '../reminderService';

/** The line about the evidence for this many sessions a day (B1.3, B4.3), or the maintenance rule (ENG-031). */
export function sessionsLine(n: number, maintenance: boolean): string {
  if (maintenance) return SETTINGS.sessionsMaintenance;
  return n > 3 ? SETTINGS.sessionsUntested : SETTINGS.sessionsTested;
}

/** What the reminders note says after a change: what changed, then whether reminders are off or paused. */
function noteLines(change: SessionsChange, s: Settings): { main: string; status: string | null; off: boolean } {
  const r = change.result;
  const main =
    r.kind === 'updated' ? SETTINGS.remindersUpdated(r.added.map((x) => x.timeLocal), r.turnedOff.map((x) => x.timeLocal)) : SETTINGS.remindersDiffer(r.reminders);
  const off = s.notification_permission !== 'granted';
  const pausedUntil = s.reminders_paused_until ? new Date(s.reminders_paused_until) : null;
  const paused = s.reminders_paused && (!pausedUntil || pausedUntil > new Date());
  const status = off
    ? SETTINGS.remindersAreOff
    : paused
      ? pausedUntil
        ? SETTINGS.remindersPausedUntil(formatShort(toLocalDate(pausedUntil)))
        : SETTINGS.remindersPaused
      : null;
  return { main, status, off };
}

export function TrainingSection({ settings: s, profile: p, set }: { settings: Settings; profile: Profile | null; set: (patch: Partial<Settings>) => Promise<void> }) {
  const { db, bump } = useApp();
  const desktop = useDesktop();
  const { data } = useLoad(async (d) => ({ maintenance: (await getProgramme(d)).phase === 'maintenance' }));
  const [change, setChange] = useState<SessionsChange | null>(null);
  const [busy, setBusy] = useState(false);
  const maintenance = !!data?.maintenance;
  const n = maintenance ? 1 : s.sessions_per_day_target;
  const line = sessionsLine(n, maintenance);

  const step = async (to: number) => {
    if (busy) return;
    setBusy(true);
    try {
      setChange(await setSessionsPerDay(db, to));
      bump();
    } finally {
      setBusy(false);
    }
  };
  const undo = async () => {
    if (!change || busy) return;
    setBusy(true);
    try {
      await undoSessionsChange(db, change);
      setChange(null);
      bump();
    } finally {
      setBusy(false);
    }
  };

  // ⌘Z (Ctrl+Z) undoes while the note shows, as on the Mac (02-desktop-patterns 6). Not inside a text field.
  useEffect(() => {
    if (Platform.OS !== 'web' || !change || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      void undo();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [change]);

  const note = change ? noteLines(change, s) : null;
  return (
    // On the Mac the evidence line sits in the section's description column, beside the controls.
    <Section title={SETTINGS.training} description={desktop ? `${DESKTOP.settingsNotes.training} ${line}` : DESKTOP.settingsNotes.training}>
      <Label>{SETTINGS.sessionsPerDay}</Label>
      {/* No upper limit (Adrian, 2026-10-03). Read-only in maintenance: 1 a day (ENG-031). */}
      <Stepper
        label={SETTINGS.sessionsPerDay}
        value={n}
        min={1}
        max={maintenance ? 1 : Infinity}
        onChange={(v) => void step(v)}
      />
      {!desktop ? (
        <P small muted>
          {line}
        </P>
      ) : null}
      {note ? (
        <Card tone="soft">
          <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
            <P>{note.main}</P>
            {note.status ? <P small muted>{note.status}</P> : null}
            {isWeb ? <P small muted>{SETTINGS.remindersMacOnly}</P> : null}
          </View>
          <Row>
            <Button label={SETTINGS.undo} kind="quiet" onPress={() => void undo()} busy={busy} />
            <Button
              label={note.off ? SETTINGS.turnOn : SETTINGS.editTimes}
              kind="quiet"
              onPress={() => router.push('/reminders')}
            />
            {isWeb && desktop ? <P small muted>{SETTINGS.undoKey}</P> : null}
          </Row>
        </Card>
      ) : null}
      <Label>{SETTINGS.weeklyTarget}</Label>
      <Stepper label={SETTINGS.weeklyTarget} value={s.weekly_days_target} min={3} max={7} onChange={(v) => set({ weekly_days_target: v })} />
      <Label>{SETTINGS.maintenanceTarget}</Label>
      <Stepper
        label={SETTINGS.maintenanceTarget}
        value={s.maintenance_days_target ?? (p?.age_band === '60_74' || p?.age_band === '75_plus' ? 5 : 4)}
        min={3}
        max={7}
        onChange={(v) => set({ maintenance_days_target: v })}
      />
      <Label>{SETTINGS.weekStart}</Label>
      <Segments label={SETTINGS.weekStart} options={SETTINGS.weekDays} value={s.week_start_day} onChange={(v) => set({ week_start_day: v })} />
      <Label>{SETTINGS.sound}</Label>
      <Segments
        label={SETTINGS.sound}
        options={SETTINGS.soundOptions.map((o) => ({ value: o.value as AudioMode, label: o.label }))}
        value={s.audio_mode}
        onChange={(v) => set({ audio_mode: v })}
      />
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
      {desktop ? <LinkRow label={SETTINGS.reminders} onPress={() => router.push('/reminders')} /> : null}
    </Section>
  );
}
