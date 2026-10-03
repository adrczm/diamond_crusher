// What a session holds: posture, blocks and real length (M6, H9). Shown on the Today card and on the session's ready screen.
import { View } from 'react-native';
import { BLOCK_NAME, GENTLE_SQUEEZE, SESSION, positionHint, positionName } from '../../content/en/exercise';
import { formatDuration } from '../../domain/dates';
import { durationS, RELAX_IN_S, type SessionPlan } from '../../domain/session/plan';
import { P, Row } from '../../ui/kit';

function Line({ name, value }: { name: string; value: string }) {
  return (
    <Row>
      <View style={{ flex: 1 }}>
        <P muted>{name}</P>
      </View>
      <P>{value}</P>
    </Row>
  );
}

export function SessionContents({ plan }: { plan: SessionPlan }) {
  const hint = positionHint(plan.position, plan.pregnant);
  const name = positionName(plan.position, plan.pregnant);
  const gentle = plan.blocks.find((b) => b.gentle);
  return (
    <View style={{ gap: 6 }}>
      <P>{hint ? `${name}. ${hint}` : name}</P>
      {gentle ? <Line name={GENTLE_SQUEEZE.name} value={`${gentle.reps} × ${gentle.onS} s`} /> : null}
      {plan.templateKey === 'strength' ? (
        <>
          <Line name={BLOCK_NAME.relax} value={`${RELAX_IN_S} s`} />
          <Line name={BLOCK_NAME.hold} value={`${plan.load.N} × ${plan.load.H} s`} />
          <Line name={BLOCK_NAME.flick} value={`${plan.load.F}`} />
          {plan.load.E ? <Line name={BLOCK_NAME.endurance} value={`${plan.load.enduranceReps} × ${plan.load.E} s`} /> : null}
        </>
      ) : null}
      <P muted>{`${SESSION.estimated} ${formatDuration(durationS(plan))}`}</P>
    </View>
  );
}
