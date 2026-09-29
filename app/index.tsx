// Home: today's session, safety state, week dots, and anything due (08 MOT-001 to MOT-004, 01 §6).
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Alert } from '../src/platform/dialog';
import { feedback } from '../src/platform/feedback';
import { AFTER_PEE, KNACK, SESSION } from '../src/content/en/exercise';
import { CAUTION_CARD, CLEARANCE, OUTCOME, RELAX_ONLY_HOME } from '../src/content/en/screening';
import { COMMON, EXPECTATION, HOME, LEVEL_NAME, MAINTENANCE, NEXT_NAME, SETUP, WELCOME_BACK } from '../src/content/en/strings';
import { formatShort } from '../src/domain/dates';
import { useApp, useLoad } from '../src/features/app';
import { backupLater, dismissSetup, loadHome, type HomeModel, type SetupKey } from '../src/features/homeService';
import { SessionContents } from '../src/features/screens/SessionContents';
import { WeekStrip, whenText } from '../src/features/screens/WeekStrip';
import { reconcileReminders } from '../src/features/reminderService';
import { clear } from '../src/features/safetyService';
import { outcomeCopy } from '../src/features/screens/ScreeningFlow';
import { applyGapChoice, keepBuilding, switchToMaintenance } from '../src/features/trainingService';
import { toLocalDate } from '../src/domain/dates';
import { Button, Card, Columns, H1, H2, Label, LinkRow, Loading, P, Row, Screen } from '../src/ui/kit';
import { isWeb, useDesktop } from '../src/ui/layout';
import { DESKTOP } from '../src/content/en/strings';
import { educationFor } from '../src/content/en/education';

export default function Home() {
  const { db, bump } = useApp();
  const desktop = useDesktop();
  const { data: m, reload: loadRetry, error: loadError } = useLoad((d) => loadHome(d));
  const [busy, setBusy] = useState(false);
  if (!m) return <Loading error={loadError} onRetry={loadRetry} />;
  if (!m.profile.onboarding_completed_at) return <Redirect href="/onboarding" />;

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

  const mode = m.safety.mode;
  const t = m.today;
  const levelName = m.levelName ? (LEVEL_NAME[m.levelName.variable]?.(m.levelName.after) ?? null) : null;
  // C2: setup moved out of onboarding, one or two cards at a time. The app lock exists on Android only.
  const setup = m.setup.filter((k) => k !== 'lock' || Platform.OS === 'android').slice(0, 2);
  const openSetup = (k: SetupKey) => {
    if (k === 'plan') router.push('/reminders');
    else if (k === 'lock') router.push('/settings');
    else {
      void act(() => dismissSetup(db, 'expect'));
      router.push('/library?id=ED-07');
    }
  };

  return (
    <Screen title={HOME.todayTitle} width="wide">
      <Row>
        <View style={{ flex: 1 }}>
          {desktop ? <P muted>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</P> : null}
          <H1>{HOME.greeting(m.profile.nickname)}</H1>
          {t.kind !== 'learn' && t.kind !== 'blocked' ? <P muted>{HOME.level(m.level, levelName, m.levelMax)}</P> : null}
        </View>
      </Row>

      <Columns ratio={[3, 2]}>
        <>
          {mode === 'blocked_urgent' || mode === 'blocked_until_cleared' ? (
            <Card tone="warn">
              <H2>{HOME.blocked}</H2>
              <P>{outcomeCopy(mode, m.safety.reasons).body}</P>
              {mode === 'blocked_urgent' ? (
                <Button label={CLEARANCE.clearedButton} kind="secondary" onPress={() => confirmClear('urgent', CLEARANCE.urgentTick)} busy={busy} />
              ) : (
                <Button label={CLEARANCE.clearedButton} kind="secondary" onPress={() => confirmClear('surgery', CLEARANCE.preSurgeryHome)} busy={busy} />
              )}
            </Card>
          ) : null}

          {mode === 'relax_only' ? (
            <Card tone="warn">
              <H2>{OUTCOME.relax_only.title}</H2>
              <P>{RELAX_ONLY_HOME}</P>
              <Button label={CLEARANCE.clearedButton} kind="secondary" onPress={() => confirmClear('pain', CLEARANCE.painTick)} busy={busy} />
            </Card>
          ) : null}

          {m.gap && t.kind !== 'blocked' ? (
            <Card tone="soft">
              <H2>{WELCOME_BACK.title}</H2>
              <P>{WELCOME_BACK.body}</P>
              <Button label={WELCOME_BACK.easier} onPress={() => act(() => applyGapChoice(db, toLocalDate(new Date()), false))} busy={busy} />
              <Button label={WELCOME_BACK.pickUp} kind="quiet" onPress={() => act(() => applyGapChoice(db, toLocalDate(new Date()), true))} disabled={busy} />
              {m.gap.band === 'long' ? (
                <P small muted>
                  {WELCOME_BACK.reviewPlan}
                </P>
              ) : null}
            </Card>
          ) : null}

          {!m.gap ? <TodayCard m={m} /> : null}

          {m.maintenanceOffer ? (
            <Card tone="soft">
              <H2>{MAINTENANCE.offerTitle}</H2>
              <P>{MAINTENANCE.offerBody}</P>
              <Button label={MAINTENANCE.switch} onPress={() => act(() => switchToMaintenance(db))} busy={busy} />
              <Button label={MAINTENANCE.keepBuilding} kind="quiet" onPress={() => act(() => keepBuilding(db))} disabled={busy} />
            </Card>
          ) : null}

          {setup.map((k) => (
            <SetupCard key={k} k={k} onOpen={() => openSetup(k)} onDismiss={() => act(() => dismissSetup(db, k))} busy={busy} />
          ))}

          {m.techniqueCheck ? <Prompt text={HOME.techniqueCheck} onPress={() => router.push('/learn?mode=recheck')} /> : null}
          {m.baselineOffer ? <Prompt text={HOME.baselineOffer} onPress={() => router.push('/selfcheck?kind=baseline')} /> : null}
          {m.safetyRecheck && mode !== 'blocked_urgent' ? <Prompt text={HOME.shortScreenDue} onPress={() => router.push('/screening?kind=periodic')} /> : null}
          {m.check?.open ? (
            <Prompt text={m.check.row.kind === 'quarterly_review' ? HOME.reviewReady : HOME.checkReady} onPress={() => router.push('/check')} />
          ) : null}
          {m.summary ? <Prompt text={HOME.summaryReady} onPress={() => router.push('/summary')} /> : null}
        </>
        <>
          {t.kind !== 'learn' && t.kind !== 'blocked' ? (
            <Card>
              <Label>{HOME.weekTitle}</Label>
              <WeekStrip week={m.week} target={m.weekTarget} />
              {m.next ? <P muted>{nextLine(m)}</P> : null}
              {m.next && m.next !== 'top' && m.weeksToNext != null ? (
                <P small muted>
                  {HOME.goodWeek(m.goodDaySessions)}
                </P>
              ) : null}
              {m.nextReminder ? <P muted>{HOME.nextReminder(whenText(m.nextReminder))}</P> : null}
              {m.check && !m.check.open ? <P muted>{HOME.nextCheck(formatShort(m.check.row.due_on))}</P> : null}
            </Card>
          ) : null}

          {desktop && t.kind === 'learn' ? (
            <Card>
              <H2>{DESKTOP.nav.library}</H2>
              {educationFor(m.profile.anatomy ?? 'other_unspecified')
                .slice(0, 4)
                .map((e) => (
                  <LinkRow key={e.id} label={e.title} onPress={() => router.push(`/library?id=${e.id}`)} />
                ))}
            </Card>
          ) : null}

          {m.cautions.length && mode === 'caution' ? (
            <Card tone="warn">
              {m.cautions.map((k) => (
                <P key={k}>{CAUTION_CARD[k]}</P>
              ))}
            </Card>
          ) : null}

          {m.settings.functional_cues_enabled && m.programme.learn_status !== 'not_started' && t.kind !== 'blocked' ? (
            <Card>
              <H2>{HOME.everyday}</H2>
              <P>{`${KNACK.title}: ${KNACK.body}`}</P>
              <P muted>{`${AFTER_PEE.title}: ${AFTER_PEE.body}`}</P>
            </Card>
          ) : null}

          {m.exportReminder ? (
            <Card tone="soft">
              <P>{HOME.exportReminder}</P>
              <Row>
                <Button label={HOME.saveBackup} kind="secondary" onPress={() => router.push('/data')} />
                <Button
                  label={COMMON.notNow}
                  kind="quiet"
                  onPress={() => act(() => backupLater(db, toLocalDate(new Date())))}
                />
              </Row>
            </Card>
          ) : null}

          <Card>
            {/* The sidebar (desktop) and the tab bar (phones) link the sections. */}
            <LinkRow label={HOME.somethingChanged} onPress={() => router.push('/screening?kind=something_changed')} />
          </Card>
        </>
      </Columns>
    </Screen>
  );
}

function nextLine(m: HomeModel): string {
  if (!m.next) return '';
  if (m.next === 'top') return MAINTENANCE.topOfProgramme;
  return m.weeksToNext != null ? HOME.nextAfter(NEXT_NAME[m.next], m.weeksToNext) : HOME.next(NEXT_NAME[m.next]);
}

function SetupCard({ k, onOpen, onDismiss, busy }: { k: SetupKey; onOpen: () => void; onDismiss: () => void; busy: boolean }) {
  const copy = SETUP[k];
  return (
    <Card tone="soft">
      <H2>{copy.title}</H2>
      <P>{copy.body}</P>
      <Row>
        <Button label={copy.action} kind="secondary" onPress={onOpen} disabled={busy} />
        <Button label={COMMON.notNow} kind="quiet" onPress={onDismiss} disabled={busy} />
      </Row>
    </Card>
  );
}

function Prompt({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Card tone="soft" onPress={onPress}>
      <Row>
        <View style={{ flex: 1 }}>
          <P>{text}</P>
        </View>
        <P muted>›</P>
      </Row>
    </Card>
  );
}

function TodayCard({ m }: { m: HomeModel }) {
  const t = m.today;
  if (t.kind === 'blocked') return null;
  if (t.kind === 'learn') {
    return (
      <Card>
        <H2>{HOME.firstStep}</H2>
        <P>{HOME.learnHint}</P>
        <Button label={HOME.learnFirst} onPress={() => router.push('/learn')} />
        <P small muted>
          {EXPECTATION}
        </P>
      </Card>
    );
  }
  if (t.kind === 'relax') {
    return (
      <Card>
        <H2>{HOME.upNext}</H2>
        <Button label={HOME.relaxPractice} onPress={() => router.push('/session?relax=1')} />
      </Card>
    );
  }
  if (t.kind === 'day_done') {
    return (
      <Card>
        <H2>{HOME.upNext}</H2>
        <P>{SESSION.dayDone}</P>
        {t.extraAllowed ? (
          <Button label={SESSION.extraStart} kind="secondary" onPress={() => router.push('/session?extra=1')} />
        ) : (
          <P muted>{SESSION.extraBlocked}</P>
        )}
        <Button label={HOME.relaxPractice} kind="quiet" onPress={() => router.push('/session?relax=1')} />
      </Card>
    );
  }
  // M6: one Start. The session's 30 s relax is the lead-in, so there is no ready screen from here.
  // On the web, sound needs a user gesture, so the players are made inside this tap.
  const start = async () => {
    await feedback.prepare().catch(() => undefined);
    router.push('/session?go=1');
  };
  return (
    <Card>
      <H2>{HOME.upNext}</H2>
      <Label>{HOME.sessionOf(t.slotsDone + 1, t.slotsTotal)}</Label>
      {t.plan ? <SessionContents plan={t.plan} /> : null}
      <Button label={HOME.startSession} onPress={start} />
      <KeyHint />
    </Card>
  );
}

/** On a Mac, a quiet reminder that S starts the session (shortcut discoverability). */
function KeyHint() {
  const desktop = useDesktop();
  if (!desktop || !isWeb) return null;
  return (
    <P small muted center>
      {DESKTOP.startKey}
    </P>
  );
}
