// The gentle squeeze in relaxation-only mode (03 ENG-061): the let-go question after a relax session, and the
// "pain has gone" answer on Today when exercise pain locked it (SX21, SX22).
import { useState } from 'react';
import { Alert } from 'react-native';
import { GENTLE_SQUEEZE } from '../../content/en/exercise';
import { COMMON } from '../../content/en/strings';
import { Button, Card, H2, P, Row } from '../../ui/kit';
import { useApp, useLoad } from '../app';
import { confirmLetGo, loadGentleState, painGone } from '../gentleService';

/** After a relax-only session: "Can you feel a full let-go?" Yes unlocks the gentle squeeze in the next sessions. */
export function GentleUnlock() {
  const { db, bump } = useApp();
  const { data: state } = useLoad((d) => loadGentleState(d), []);
  const [done, setDone] = useState<'yes' | 'later' | null>(null);
  if (state !== 'ask' || done === 'later') return null;
  if (done === 'yes') {
    return (
      <Card tone="soft">
        <P>{GENTLE_SQUEEZE.unlocked}</P>
      </Card>
    );
  }
  return (
    <Card tone="soft">
      <H2>{GENTLE_SQUEEZE.letGoQuestion}</H2>
      <P>{GENTLE_SQUEEZE.letGoNote}</P>
      <Row>
        <Button
          label={GENTLE_SQUEEZE.letGoYes}
          kind="secondary"
          onPress={async () => {
            await confirmLetGo(db);
            setDone('yes');
            bump();
          }}
        />
        <Button label={GENTLE_SQUEEZE.letGoNotYet} kind="quiet" onPress={() => setDone('later')} />
      </Row>
    </Card>
  );
}

/** On Today's relax card while exercise pain keeps the gentle squeeze off. */
export function GentlePainLock({ busy }: { busy?: boolean }) {
  const { db, bump } = useApp();
  const { data: state, reload } = useLoad((d) => loadGentleState(d), []);
  if (state !== 'pain_locked') return null;
  const ask = () =>
    Alert.alert(GENTLE_SQUEEZE.painGone, GENTLE_SQUEEZE.painGoneConfirm, [
      { text: COMMON.cancel, style: 'cancel' },
      {
        text: COMMON.yes,
        onPress: async () => {
          await painGone(db);
          reload();
          bump();
        },
      },
    ]);
  return (
    <>
      <P muted>{GENTLE_SQUEEZE.painLocked}</P>
      <Button label={GENTLE_SQUEEZE.painGone} kind="quiet" onPress={ask} disabled={busy} />
    </>
  );
}
