// Today (08 MOT-001 to MOT-004, MOT-031, MOT-032, 01 §6), round 2 (2026-10-03):
// safety first (decision 6), a heading that says where the day is (D5, HE-08), the level path or rings (A1),
// one "This week + Today" card (A3), one suggestion queue capped at 2, a one-line tip, and quiet link rows.
// Below c3 one column in the phone order; at c3 and wider 8 + 4 columns with the level card on the right (M6).
import { Redirect, router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Alert } from '../src/platform/dialog';
import { CLEARANCE, OUTCOME, RELAX_ONLY_HOME } from '../src/content/en/screening';
import { COMMON, DESKTOP, EXPECTATION, HOME, MAINTENANCE, SETUP, WELCOME_BACK } from '../src/content/en/strings';
import { educationFor } from '../src/content/en/education';
import { setTodayHero, type TodayHero } from '../src/data/repositories/settings';
import type { FlagResponse } from '../src/data/repositories/safety';
import { diffDays, isoWeekday, toLocalDate } from '../src/domain/dates';
import { useApp, useLoad } from '../src/features/app';
import { loadHome, seeLevelUp, suggestionLater, SUGGESTION_CAP, type HomeModel, type SuggestionKey } from '../src/features/homeService';
import { reconcileReminders } from '../src/features/reminderService';
import { answerHealthNote, clear } from '../src/features/safetyService';
import { outcomeCopy } from '../src/features/screens/ScreeningFlow';
import { HeroCard, levelNameOf } from '../src/features/screens/TodayHero';
import { HealthNoteCard, LevelUpCard, SuggestionCard, TipLine } from '../src/features/screens/TodayNotes';
import { TodayPlanCard } from '../src/features/screens/TodayPlan';
import { applyGapChoice, keepBuilding, switchToMaintenance } from '../src/features/trainingService';
import { Button, Card, H1, H2, LinkRow, Loading, P, Screen, useContentWidth } from '../src/ui/kit';
import { TWO_COLUMNS_MIN, useDesktop } from '../src/ui/layout';
import { space } from '../src/ui/theme';

export default function Home() {
  const { data: m, reload: loadRetry, error: loadError } = useLoad((d) => loadHome(d));
  if (!m) return <Loading error={loadError} onRetry={loadRetry} />;
  if (!m.profile.onboarding_completed_at) return <Redirect href="/onboarding" />;
  return (
    <Screen title={HOME.todayTitle} width="wide">
      <TodayBody m={m} />
    </Screen>
  );
}

/** Inside Screen, so the layout follows the page's measured width (Mac decision M1). */
function TodayBody({ m }: { m: HomeModel }) {
  const { db, bump } = useApp();
  const desktop = useDesktop();
  const wide = useContentWidth() >= TWO_COLUMNS_MIN;
  const [busy, setBusy] = useState(false);
  const [allSuggestions, setAllSuggestions] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [hero, setHero] = useState<TodayHero>(m.hero);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      reconcileReminders(db);
      bump();
    } finally {
      setBusy(false);
    }
  };
  const confirmClear = (kind: 'urgent' | 'pain' | 'surgery', text: string) =>
    Alert.alert(CLEARANCE.clearedButton, text, [
      { text: COMMON.cancel, style: 'cancel' },
      { text: COMMON.yes, onPress: () => act(() => clear(db, kind)) },
    ]);
  const pickHero = (v: TodayHero) => {
    setHero(v);
    void setTodayHero(db, m.settings, v).catch((e) => console.warn('hero', e));
  };
  const answerNote = (r: FlagResponse) => {
    setNoteOpen(false);
    void act(() => answerHealthNote(db, r));
  };

  const mode = m.safety.mode;
  const t = m.today;
  const today = toLocalDate(new Date());
  const note = m.healthNote;
  const showsProgress = t.kind === 'strength' || t.kind === 'day_done' || t.kind === 'relax';

  // ---- Safety first (decision 6): stops, relax only, and the doctor note. ----
  const safety: ReactNode[] = [];
  if (mode === 'blocked_urgent' || mode === 'blocked_until_cleared') {
    safety.push(
      <Card key="blocked" tone="warn">
        <P>{outcomeCopy(mode, m.safety.reasons).body}</P>
        {mode === 'blocked_urgent' ? (
          <Button label={CLEARANCE.clearedButton} kind="secondary" onPress={() => confirmClear('urgent', CLEARANCE.urgentTick)} busy={busy} />
        ) : (
          <Button label={CLEARANCE.clearedButton} kind="secondary" onPress={() => confirmClear('surgery', CLEARANCE.preSurgeryHome)} busy={busy} />
        )}
      </Card>
    );
  }
  if (mode === 'relax_only') {
    safety.push(
      <Card key="relax" tone="warn">
        <H2>{OUTCOME.relax_only.title}</H2>
        <P>{RELAX_ONLY_HOME}</P>
        <Button label={CLEARANCE.clearedButton} kind="secondary" onPress={() => confirmClear('pain', CLEARANCE.painTick)} busy={busy} />
      </Card>
    );
  }
  // A2: the note shows until it is answered, and comes back only when answers or logged results change.
  if (note.show) safety.push(<HealthNoteCard key="note" keys={note.keys} onAnswer={answerNote} busy={busy} />);

  // ---- Heading (D5, HE-08): the date, then where the day is. The nickname stays as a small hello. ----
  const [, month, dayOfMonth] = today.split('-').map(Number);
  const heading = m.gap && t.kind !== 'blocked'
    ? WELCOME_BACK.title
    : t.kind === 'learn'
      ? HOME.firstStep
      : t.kind === 'blocked'
        ? HOME.blocked
        : t.kind === 'relax'
          ? HOME.headRelax
          : t.kind === 'day_done'
            ? HOME.headDone
            : HOME.sessionOf(t.slotsDone + 1, t.slotsTotal);
  const head = (
    <View key="head" style={{ gap: space(0.5) }}>
      <P muted>{HOME.dateLine(HOME.dayNames[isoWeekday(today) - 1], dayOfMonth, HOME.monthNames[month - 1])}</P>
      <H1>{heading}</H1>
      {m.profile.nickname ? (
        <P small muted>
          {HOME.greeting(m.profile.nickname)}
        </P>
      ) : null}
    </View>
  );

  // ---- State cards that replace or lead the day: level up, welcome back, maintenance offer. ----
  const lead: ReactNode[] = [];
  if (m.levelUp && showsProgress) {
    lead.push(<LevelUpCard key="levelup" name={levelNameOf(m)} onSeen={() => act(() => seeLevelUp(db))} />);
  }
  if (m.gap && t.kind !== 'blocked') {
    lead.push(
      <Card key="gap" tone="soft">
        <P>{WELCOME_BACK.body}</P>
        <Button label={WELCOME_BACK.easier} onPress={() => act(() => applyGapChoice(db, today, false))} busy={busy} />
        <Button label={WELCOME_BACK.pickUp} kind="quiet" onPress={() => act(() => applyGapChoice(db, today, true))} disabled={busy} />
        {m.gap.band === 'long' ? (
          <P small muted>
            {WELCOME_BACK.reviewPlan}
          </P>
        ) : null}
      </Card>
    );
  }
  if (m.maintenanceOffer) {
    lead.push(
      <Card key="maint" tone="soft">
        <H2>{MAINTENANCE.offerTitle}</H2>
        <P>{MAINTENANCE.offerBody}</P>
        <Button label={MAINTENANCE.switch} onPress={() => act(() => switchToMaintenance(db))} busy={busy} />
        <Button label={MAINTENANCE.keepBuilding} kind="quiet" onPress={() => act(() => keepBuilding(db))} disabled={busy} />
      </Card>
    );
  }

  // ---- The top card (A1) and the merged card (A3). ----
  const heroCard = showsProgress ? <HeroCard key="hero" m={{ ...m, hero }} onChange={pickHero} /> : null;
  let planCard: ReactNode = null;
  if (t.kind === 'learn') {
    planCard = (
      <Card key="plan">
        <P>{HOME.learnHint}</P>
        <Button label={HOME.learnFirst} onPress={() => router.push('/learn')} />
        <P small muted>
          {EXPECTATION}
        </P>
      </Card>
    );
  } else if (showsProgress && !m.gap) {
    planCard = <TodayPlanCard key="plan" m={m} />;
  }

  // ---- One suggestion queue (critique priority 2): safety first, at most 2, the rest behind one button. ----
  const shown = allSuggestions ? m.suggestions : m.suggestions.slice(0, SUGGESTION_CAP);
  const suggestions: ReactNode[] = shown.map((k) => (
    <Suggestion key={k} k={k} busy={busy} onLater={k === 'safety' ? undefined : () => act(() => suggestionLater(db, k, today))} />
  ));
  if (!allSuggestions && m.suggestions.length > SUGGESTION_CAP) {
    suggestions.push(<Button key="more" label={HOME.morePrompts(m.suggestions.length - SUGGESTION_CAP)} kind="quiet" onPress={() => setAllSuggestions(true)} />);
  }

  // ---- The tip and the link rows. ----
  const tip =
    m.settings.functional_cues_enabled && m.programme.learn_status !== 'not_started' && t.kind !== 'blocked' ? (
      <TipLine key="tip" anatomy={m.profile.anatomy ?? 'other_unspecified'} day={diffDays('2000-01-01', today)} />
    ) : null;
  const links = (
    <View key="links">
      {note.hidden && !noteOpen ? <LinkRow label={HOME.healthNote.row(note.keys.length)} onPress={() => setNoteOpen(true)} /> : null}
      {note.hidden && noteOpen ? <HealthNoteCard keys={note.keys} onAnswer={answerNote} busy={busy} /> : null}
      {/* W3: say what counts as a change, so the row is not only a question. */}
      <LinkRow label={HOME.somethingChanged} hint={HOME.somethingChangedHint} onPress={() => router.push('/screening?kind=something_changed')} />
    </View>
  );
  // The Mac shows Library in the right column (3 articles and All); in the learn state it shows on any desktop width.
  const library =
    wide || (desktop && t.kind === 'learn') ? (
      <Card key="library">
        <H2>{DESKTOP.nav.library}</H2>
        {educationFor(m.profile.anatomy ?? 'other_unspecified')
          .slice(0, 3)
          .map((e) => (
            <LinkRow key={e.id} label={e.title} onPress={() => router.push(`/library?id=${e.id}`)} />
          ))}
        <LinkRow label={HOME.allArticles} onPress={() => router.push('/library')} />
      </Card>
    ) : null;

  if (!wide) {
    return (
      <>
        {safety}
        {head}
        {lead}
        {heroCard}
        {planCard}
        {suggestions}
        {tip}
        {library}
        {links}
      </>
    );
  }
  // c3 and wider: the safety note spans both columns; left 8/12, right 4/12 (Mac M6).
  return (
    <>
      {safety}
      {head}
      <View style={{ flexDirection: 'row', gap: space(2.5), alignItems: 'flex-start' }}>
        <View style={{ flex: 2, minWidth: 0, gap: space(2.5) }}>
          {lead}
          {planCard}
          {suggestions}
          {tip}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: space(2.5) }}>
          {heroCard}
          {library}
          {links}
        </View>
      </View>
    </>
  );
}

function Suggestion({ k, busy, onLater }: { k: SuggestionKey; busy: boolean; onLater?: () => void }) {
  const copy = k === 'plan' || k === 'expect' || k === 'lock' ? SETUP[k] : HOME.suggest[k];
  const open = () => {
    if (k === 'safety') router.push('/screening?kind=periodic');
    else if (k === 'check' || k === 'review') router.push('/check');
    else if (k === 'technique') router.push('/learn?mode=recheck');
    else if (k === 'baseline') router.push('/selfcheck?kind=baseline');
    else if (k === 'summary') router.push('/summary');
    else if (k === 'plan') router.push('/reminders');
    else if (k === 'lock') router.push('/settings');
    else if (k === 'backup') router.push('/data');
    else if (k === 'expect') {
      // Opening "What to expect" counts as read (C2).
      onLater?.();
      router.push('/library?id=ED-07');
    }
  };
  return <SuggestionCard title={copy.title} body={copy.body} action={copy.action} onOpen={open} onLater={onLater} busy={busy} />;
}
