// Today cards for the symptom check-in (06c PFB-048): the progression hold with the optional lighter week (04 PRG-035)
// and the firmer card "See a pelvic health physio or doctor." (01 ONB-034).
import { router } from 'expo-router';
import { View } from 'react-native';
import { CHECKIN } from '../../content/en/checkin';
import { HOME } from '../../content/en/strings';
import type { FlagResponse } from '../../data/repositories/safety';
import { formatShort } from '../../domain/dates';
import type { CheckinHome } from '../checkinService';
import { Icon } from '../../ui/icons';
import { Button, Card, H2, P, Row } from '../../ui/kit';
import { space, useColors } from '../../ui/theme';

/** PRG-035: the plan is held after a "worse" check-in. Training continues; a lighter week is offered as an opt-in only. */
export function CheckinHoldCard({ hold, onLighter, busy }: { hold: CheckinHome['hold']; onLighter: () => void; busy: boolean }) {
  return (
    <Card tone="soft">
      <H2>{CHECKIN.hold.title}</H2>
      {hold.since ? <P>{CHECKIN.hold.body(formatShort(hold.since))}</P> : null}
      <P>{CHECKIN.hold.keepTraining}</P>
      {hold.lighterUntil ? (
        <P muted>{CHECKIN.hold.lighterOn(formatShort(hold.lighterUntil))}</P>
      ) : (
        <View style={{ gap: space(0.5) }}>
          <P>{CHECKIN.hold.lighterTitle}</P>
          <P small muted>
            {`${CHECKIN.hold.lighterBody} ${CHECKIN.hold.noResearch}`}
          </P>
        </View>
      )}
      <Row>
        {hold.lighterUntil ? null : <Button label={CHECKIN.hold.lighterButton} kind="secondary" onPress={onLighter} disabled={busy} />}
        <Button label={CHECKIN.hold.checkAgain} kind="quiet" onPress={() => router.push('/checkin?reason=follow_up')} disabled={busy} />
      </Row>
    </Card>
  );
}

/** ONB-034: "See a pelvic health physio or doctor." with the three answers of the health note (PFB-047). */
export function CheckinEscalationCard({ why, onAnswer, busy }: { why: CheckinHome['escalation']['why']; onAnswer: (r: FlagResponse) => void; busy: boolean }) {
  const c = useColors();
  return (
    <Card tone="warn">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
        <Icon name="alert" size={20} color={c.warn} />
        <View style={{ flex: 1 }}>
          <H2>{CHECKIN.escalation.title}</H2>
        </View>
      </View>
      <P>{CHECKIN.escalation.body}</P>
      {why.map((w) => (
        <P key={w} muted>
          {CHECKIN.escalation[w]}
        </P>
      ))}
      <P>{CHECKIN.escalation.keepTraining}</P>
      <Row>
        <Button label={HOME.healthNote.gotIt} kind="secondary" onPress={() => onAnswer('dismissed')} disabled={busy} />
        <Button label={HOME.healthNote.willBook} kind="secondary" onPress={() => onAnswer('will_book')} disabled={busy} />
        <Button label={HOME.healthNote.alreadySeen} kind="secondary" onPress={() => onAnswer('already_seen')} disabled={busy} />
      </Row>
    </Card>
  );
}
