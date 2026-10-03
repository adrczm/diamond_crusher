// Check-ins: the monthly check and 12-week review hub (06b §3.3), where parts can be done separately. Between checks
// it shows when the next check opens and is due, with the parts locked, a self-check at any time, and the past checks (UX audit H5).
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { EVENTS } from '../src/content/en/items';
import { BUNDLE, COMMON, DATA, DESKTOP } from '../src/content/en/strings';
import { REVIEW_12W_CARD } from '../src/content/en/screening';
import { listScheduledChecks } from '../src/data/repositories/checks';
import { nextCheckWindow, pastChecks, type CheckWindow, type PastCheck } from '../src/domain/checkins';
import { formatShort, toLocalDate } from '../src/domain/dates';
import { useApp, useLoad } from '../src/features/app';
import { leaveFlow } from '../src/features/screens/GuidedFlow';
import { Alert } from '../src/platform/dialog';
import { checkLine, currentCheck, markPart, modulesForCheck, skipCheck, type CheckDue } from '../src/features/checkService';
import { saveSexualFlag } from '../src/features/checkService';
import { reconcileReminders } from '../src/features/reminderService';
import type { BundleKind } from '../src/domain/schedule';
import { Icon } from '../src/ui/icons';
import { Button, Card, Choice, H1, H2, LinkRow, Loading, P, Row, Screen } from '../src/ui/kit';
import { Text } from '../src/ui/text';
import { space, type, useColors } from '../src/ui/theme';

const checkName = (kind: string) => (kind === 'quarterly_review' ? BUNDLE.quarterlyTitle : BUNDLE.monthlyTitle);

export default function CheckHub() {
  const { db, bump } = useApp();
  const today = toLocalDate(new Date());
  const { data, reload: loadRetry, error: loadError } = useLoad(async (d) => {
    const c = await currentCheck(d, today);
    const rows = await listScheduledChecks(d);
    return {
      check: c,
      modules: c ? await modulesForCheck(d, c.row.kind as BundleKind) : [],
      past: pastChecks(rows, (iso) => toLocalDate(new Date(iso))),
      next: nextCheckWindow(rows),
    };
  });
  const [sexual, setSexual] = useState<'yes' | 'no' | 'prefer_not' | undefined>();
  const [allDone, setAllDone] = useState(false);
  if (!data) return <Loading error={loadError} onRetry={loadRetry} />;
  const c = data.check;
  if (allDone) {
    return (
      <Screen title={DESKTOP.nav.check} footer={<Button label={COMMON.done} onPress={leaveFlow} />}>
        <H1>{BUNDLE.allDone}</H1>
        <Card tone="soft" onPress={() => router.replace('/data')}>
          <P>{BUNDLE.exportOffer}</P>
        </Card>
        <P muted>{DATA.updateNote}</P>
      </Screen>
    );
  }
  const extras = (
    <>
      <SelfCheckNow />
      <History past={data.past} />
    </>
  );
  if (!c) {
    return (
      <Screen title={DESKTOP.nav.check}>
        <Card>
          <P>{BUNDLE.noneYet}</P>
        </Card>
        {extras}
      </Screen>
    );
  }
  if (!c.open) {
    return (
      <Screen title={DESKTOP.nav.check}>
        <Upcoming check={c} next={data.next} />
        {extras}
      </Screen>
    );
  }
  const quarterly = c.row.kind === 'quarterly_review';
  const q = `checkId=${c.row.id}&parts=${c.parts.join(',')}`;
  const done = (p: string) => c.row.parts_done.includes(p);
  const finishPart = async (p: 'sexual_flag') => {
    const complete = await markPart(db, c.row.id, p, c.parts);
    reconcileReminders(db);
    bump();
    if (complete) setAllDone(true);
  };
  return (
    <Screen title={DESKTOP.nav.check}>
      <H1>{checkName(c.row.kind)}</H1>
      <P muted>{BUNDLE.expected(quarterly ? 10 : 8)}</P>
      {quarterly ? <P muted>{REVIEW_12W_CARD}</P> : null}
      {!data.modules.some((m) => m.validated) ? <P small muted>{BUNDLE.noValidated}</P> : null}
      {c.parts.map((p) => (
        <Card key={p}>
          <Row>
            <H2>{BUNDLE.parts[p]}</H2>
            {done(p) ? <P muted>{BUNDLE.partDone}</P> : null}
          </Row>
          {p === 'sexual_flag' && !done(p) ? (
            <>
              <P>{EVENTS.sexualActivityFlag}</P>
              <Choice label={EVENTS.sexualActivityFlag} options={EVENTS.sexualActivityOptions.map((o) => ({ value: o.value, label: o.label }))} value={sexual} onChange={setSexual} />
              <Button
                label={COMMON.save}
                disabled={!sexual}
                onPress={async () => {
                  await saveSexualFlag(db, sexual as 'yes' | 'no' | 'prefer_not', today);
                  await finishPart('sexual_flag');
                }}
              />
            </>
          ) : null}
          {p !== 'sexual_flag' && !done(p) ? (
            <Button
              label={BUNDLE.startPart}
              accessibilityLabel={BUNDLE.startPartFor(BUNDLE.parts[p])}
              kind="secondary"
              onPress={() =>
                router.push(
                  p === 'safety' ? `/screening?kind=periodic&${q}` : p === 'questionnaires' ? `/questionnaire?${q}` : `/selfcheck?kind=monthly&${q}`
                )
              }
            />
          ) : null}
        </Card>
      ))}
      <Button
        label={BUNDLE.skip}
        kind="quiet"
        // One tap no longer throws a half-done check away (DS-E18).
        onPress={() =>
          Alert.alert(BUNDLE.skipAsk, BUNDLE.skipAskBody, [
            { text: COMMON.cancel, style: 'cancel' },
            {
              text: BUNDLE.skip,
              style: 'destructive',
              onPress: async () => {
                await skipCheck(db, c.row.id);
                reconcileReminders(db);
                bump();
                leaveFlow();
              },
            },
          ])
        }
      />
      <History past={data.past} />
    </Screen>
  );
}

/** The next check before it opens: when it opens and is due, and its parts, locked, so nothing looks tappable before its time. */
function Upcoming({ check, next }: { check: CheckDue; next: CheckWindow | null }) {
  const c = useColors();
  const quarterly = check.row.kind === 'quarterly_review';
  const opens = formatShort(check.row.window_open);
  return (
    <Card>
      <H2>{checkName(check.row.kind)}</H2>
      {/* W2: the same "opens …, due …" line as Today and Progress. */}
      {next ? <P>{checkLine(next)}</P> : null}
      <P muted>{BUNDLE.aboutMinutes(quarterly ? 10 : 8)}</P>
      <View style={{ gap: 0 }}>
        {check.parts.map((p, i) => (
          <View
            key={p}
            accessible
            accessibilityLabel={BUNDLE.lockedPart(BUNDLE.parts[p], opens)}
            accessibilityState={{ disabled: true }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space(1.25),
              minHeight: 48,
              borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
              borderColor: c.border,
            }}
          >
            <Icon name="lock" size={18} color={c.muted} />
            <Text style={[type('body-md'), { color: c.muted, flex: 1 }]}>{BUNDLE.parts[p]}</Text>
            <Text style={[type('body-sm'), { color: c.muted }]}>{BUNDLE.opensOn(opens)}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function SelfCheckNow() {
  return (
    <Card>
      <H2>{BUNDLE.selfCheckTitle}</H2>
      <P muted>{BUNDLE.selfCheckBody}</P>
      <Button label={BUNDLE.selfCheckNow} kind="secondary" onPress={() => router.push('/selfcheck')} />
    </Card>
  );
}

/** Past checks, newest first. Results live on the Progress page, so a done check links there. */
function History({ past }: { past: PastCheck[] }) {
  const c = useColors();
  return (
    <Card>
      <H2>{BUNDLE.historyTitle}</H2>
      {past.length === 0 ? <P muted>{BUNDLE.historyEmpty}</P> : null}
      {past.map((h) =>
        h.status === 'completed' ? (
          <LinkRow
            key={h.row.id}
            label={`${checkName(h.row.kind)}, ${formatShort(h.on)}`}
            detail={BUNDLE.seeResults}
            onPress={() => router.navigate('/progress')}
          />
        ) : (
          <View key={h.row.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space(1), minHeight: 48 }}>
            <Text style={[type('body-md'), { color: c.text, flex: 1 }]}>{`${checkName(h.row.kind)}, ${formatShort(h.on)}`}</Text>
            <Text style={[type('body-sm'), { color: c.muted }]}>{BUNDLE.historyStatus[h.status]}</Text>
          </View>
        )
      )}
    </Card>
  );
}
