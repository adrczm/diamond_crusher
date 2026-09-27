// Home: today's session, safety state, week dots, and anything due (08 MOT-001 to MOT-004, 01 §6).
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Alert } from '../src/platform/dialog';
import { AFTER_PEE, KNACK, SESSION } from '../src/content/en/exercise';
import { CAUTION_CARD, CLEARANCE, OUTCOME, RELAX_ONLY_HOME } from '../src/content/en/screening';
import { COMMON, EXPECTATION, HOME, LEVEL_NAME, MAINTENANCE, NEXT_NAME, WELCOME_BACK } from '../src/content/en/strings';
import { formatDuration, formatShort } from '../src/domain/dates';
import { durationS } from '../src/domain/session/plan';
import { useApp, useLoad } from '../src/features/app';
import { loadHome } from '../src/features/homeService';
import { reconcileReminders } from '../src/features/reminderService';
import { clear } from '../src/features/safetyService';
import { outcomeCopy } from '../src/features/screens/ScreeningFlow';
import { applyGapChoice, keepBuilding, switchToMaintenance } from '../src/features/trainingService';
import { updateSettings } from '../src/data/repositories/settings';
import { toLocalDate } from '../src/domain/dates';
import { Banner, Button, Card, Dots, H1, H2, Label, LinkRow, Loading, P, Row, Screen } from '../src/ui/kit';

export default function Home() {
  const { db, bump } = useApp();
  const { data: m } = useLoad((d) => loadHome(d));
  const [busy, setBusy] = useState(false);
  if (!m) return <Loading />;
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
  const levelName = m.levelName ? LEVEL_NAME[m.levelName.variable]?.(m.levelName.after) ?? null : null;

  return (
    <Screen title={HOME.greeting(m.profile.nickname)}>
      <Row>
        <View style={{ flex: 1 }}>
          <H1>{HOME.greeting(m.profile.nickname)}</H1>
          {t.kind !== 'learn' && t.kind !== 'blocked' ? <P muted>{HOME.level(m.level, levelName)}</P> : null}
        </View>
      </Row>

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
          {m.gap.band === 'long' ? <P small muted>{WELCOME_BACK.reviewPlan}</P> : null}
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

      {m.techniqueCheck ? <Prompt text={HOME.techniqueCheck} onPress={() => router.push('/learn?mode=recheck')} /> : null}
      {m.baselineOffer ? <Prompt text={HOME.baselineOffer} onPress={() => router.push('/selfcheck?kind=baseline')} /> : null}
      {m.safetyRecheck && mode !== 'blocked_urgent' ? <Prompt text={HOME.shortScreenDue} onPress={() => router.push('/screening?kind=periodic')} /> : null}
      {m.check?.open ? (
        <Prompt text={m.check.row.kind === 'quarterly_review' ? HOME.reviewReady : HOME.checkReady} onPress={() => router.push('/check')} />
      ) : null}
      {m.summary ? <Prompt text={HOME.summaryReady} onPress={() => router.push('/summary')} /> : null}

      {t.kind !== 'learn' && t.kind !== 'blocked' ? (
        <Card>
          <Label>{HOME.weekTitle}</Label>
          <Dots filled={m.week.days.map((d) => d.trained)} total={7} today={m.week.days.findIndex((d) => d.isToday)} />
          <P>{m.week.trainedCount >= m.weekTarget ? HOME.weekNice(m.weekTarget) : HOME.weekCount(m.week.trainedCount, m.weekTarget)}</P>
          {m.next ? <P muted>{m.next === 'top' ? MAINTENANCE.topOfProgramme : HOME.next(NEXT_NAME[m.next])}</P> : null}
          {m.check && !m.check.open ? <P muted>{HOME.nextCheck(formatShort(m.check.row.due_on))}</P> : null}
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
            <Button label="Save a backup" kind="secondary" onPress={() => router.push('/data')} />
            <Button
              label={COMMON.notNow}
              kind="quiet"
              onPress={() => act(() => updateSettings(db, { export_reminder_days: m.settings.export_reminder_days + 30 }))}
            />
          </Row>
        </Card>
      ) : null}

      <Card>
        <LinkRow label={HOME.logSomething} onPress={() => router.push('/log')} />
        <LinkRow label="Progress" onPress={() => router.push('/progress')} />
        <LinkRow label="Learn library" onPress={() => router.push('/library')} />
        <LinkRow label={HOME.somethingChanged} onPress={() => router.push('/screening?kind=something_changed')} />
        <LinkRow label="Settings" onPress={() => router.push('/settings')} />
      </Card>
    </Screen>
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

function TodayCard({ m }: { m: NonNullable<Awaited<ReturnType<typeof loadHome>>> }) {
  const t = m.today;
  if (t.kind === 'blocked') return null;
  if (t.kind === 'learn') {
    return (
      <Card>
        <H2>{HOME.todayTitle}</H2>
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
        <H2>{HOME.todayTitle}</H2>
        <Button label={HOME.relaxPractice} onPress={() => router.push('/session?relax=1')} />
      </Card>
    );
  }
  if (t.kind === 'day_done') {
    return (
      <Card>
        <H2>{HOME.todayTitle}</H2>
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
  return (
    <Card>
      <H2>{HOME.todayTitle}</H2>
      <P>{`${HOME.sessionOf(t.slotsDone + 1, t.slotsTotal)} · ${SESSION.positionName[t.plan?.position ?? 'lying']} · ${SESSION.estimated} ${formatDuration(t.plan ? durationS(t.plan) : 0)}`}</P>
      <Button label={HOME.startSession} onPress={() => router.push('/session')} />
    </Card>
  );
}
