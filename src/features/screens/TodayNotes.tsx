// Today's quieter parts (round 2): the doctor note (A2, ONB-023), one suggestion look (critique priority 2), the
// level-up card (MOT-032) and the everyday-squeeze tip on the page background.
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { everydaySqueezes } from '../../content/en/exercise';
import { CAUTION_CARD } from '../../content/en/screening';
import { COMMON, HOME } from '../../content/en/strings';
import type { FlagResponse } from '../../data/repositories/safety';
import type { Anatomy } from '../../domain/types';
import { Icon } from '../../ui/icons';
import { Button, Card, H2, P, Row, type PressState } from '../../ui/kit';
import { Text } from '../../ui/text';
import { radius, space, type, useColors } from '../../ui/theme';

/** "Worth getting checked": every caution in one card, with three answers that hide it until something changes. */
export function HealthNoteCard({ keys, onAnswer, busy }: { keys: readonly string[]; onAnswer: (r: FlagResponse) => void; busy: boolean }) {
  const c = useColors();
  return (
    <Card tone="warn">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
        <Icon name="alert" size={20} color={c.warn} />
        <View style={{ flex: 1 }}>
          <H2>{HOME.healthNote.title}</H2>
        </View>
      </View>
      {keys.map((k) => (
        <P key={k}>{CAUTION_CARD[k]}</P>
      ))}
      <Row>
        <Button label={HOME.healthNote.gotIt} kind="secondary" onPress={() => onAnswer('dismissed')} disabled={busy} />
        <Button label={HOME.healthNote.willBook} kind="secondary" onPress={() => onAnswer('will_book')} disabled={busy} />
        <Button label={HOME.healthNote.alreadySeen} kind="secondary" onPress={() => onAnswer('already_seen')} disabled={busy} />
      </Row>
      <P small muted>
        {HOME.healthNote.returns}
      </P>
    </Card>
  );
}

/** One look for everything the app suggests: title, one line, the main action and Not now (when allowed). */
export function SuggestionCard({
  title,
  body,
  action,
  onOpen,
  onLater,
  busy,
}: {
  title: string;
  body: string;
  action: string;
  onOpen: () => void;
  onLater?: () => void;
  busy: boolean;
}) {
  return (
    <Card tone="soft">
      <H2>{title}</H2>
      <P>{body}</P>
      <Row>
        <Button label={action} kind="secondary" onPress={onOpen} disabled={busy} />
        {onLater ? <Button label={COMMON.notNow} kind="quiet" onPress={onLater} disabled={busy} /> : null}
      </Row>
    </Card>
  );
}

/** MOT-032: one quiet card when a new level is reached. No confetti, no animation. */
export function LevelUpCard({ name, onSeen }: { name: string; onSeen: () => void }) {
  const c = useColors();
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: space(1.5), alignItems: 'flex-start' }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.goodSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="done" size={20} color={c.text} />
        </View>
        <View style={{ flex: 1, gap: space(0.5) }}>
          <H2>{HOME.levelUp.title(name)}</H2>
          <P>{HOME.levelUp.body}</P>
        </View>
      </View>
      <Row>
        <Button label={HOME.levelUp.ok} kind="secondary" onPress={onSeen} />
      </Row>
    </Card>
  );
}

/** Everyday squeezes as one line on the page, no card: the knack or the after-pee squeeze, a different one each day. */
export function TipLine({ anatomy, day }: { anatomy: Anatomy; day: number }) {
  const c = useColors();
  const tips = everydaySqueezes(anatomy);
  const tip = tips[day % tips.length];
  const split = tip.indexOf(': ');
  const head = split > 0 ? tip.slice(0, split) : '';
  const body = split > 0 ? tip.slice(split + 2) : tip;
  return (
    <View style={{ flexDirection: 'row', gap: space(1), alignItems: 'flex-start', paddingHorizontal: space(0.5) }}>
      <View style={{ paddingTop: 2 }}>
        <Icon name="info" size={18} color={c.muted} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[type('body-md'), { color: c.text }]}>
          {head ? <Text style={{ fontWeight: '700' }}>{`${head}. `}</Text> : null}
          {body}
        </Text>
        <Pressable accessibilityRole="link" onPress={() => router.push('/library?id=ED-08')} hitSlop={8} style={(st) => ({ alignSelf: 'flex-start', opacity: st.pressed ? 0.7 : 1, borderRadius: radius.sm, backgroundColor: (st as PressState).hovered ? c.hover : 'transparent' })}>
          <Text style={[type('body-md'), { color: c.link }]}>{HOME.moreTips}</Text>
        </Pressable>
      </View>
    </View>
  );
}
