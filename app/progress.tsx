// Progress (06c, round 2 decisions P1 to P5, Mac M3): training consistency first, then how your squeezes feel with
// milestones, one "Your record" card, sexual activity items and a quiet Other records list. History is gone: its level
// changes are milestones now. Layout follows the page's own width: one column (c1, c2), feel and record side by side (c3),
// and a right detail panel (c4).
import { useMemo, useState, type ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { PROGRESS } from '../src/content/en/strings';
import { toLocalDate } from '../src/domain/dates';
import { useLoad } from '../src/features/app';
import { buildProgress, loadProgress, type ProgressRaw } from '../src/features/progressService';
import {
  ConsistencyCard,
  FeelCard,
  OtherRecordsCard,
  RecordCard,
  SexualCard,
  type CardProps,
  type Detail,
  type ProgressView,
} from '../src/features/screens/ProgressCards';
import { DetailPanel } from '../src/features/screens/ProgressDetails';
import { Loading, Screen, useContentClass } from '../src/ui/kit';
import { space } from '../src/ui/theme';

export default function Progress() {
  const { data, reload, error } = useLoad(loadProgress);
  if (!data) return <Loading error={error} onRetry={reload} />;
  return (
    <Screen title={PROGRESS.title} width="full">
      <Body raw={data} />
    </Screen>
  );
}

const GAP = space(2.5);
const PANEL_W = 320;
const MAIN_MAX = 1200;

function Side({ children }: { children: ReactNode[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: GAP, alignItems: 'flex-start' }}>
      {children.map((k, i) => (
        <View key={i} style={{ flex: 1, minWidth: 0, gap: GAP }}>
          {k}
        </View>
      ))}
    </View>
  );
}

function Body({ raw }: { raw: ProgressRaw }) {
  const cls = useContentClass();
  const today = toLocalDate(new Date());
  const m = useMemo(() => buildProgress(raw, today), [raw, today]);
  const [v, setV] = useState<ProgressView>({
    consRange: 'all',
    recRange: 'all',
    position: 'lying',
    measure: 'longest_hold',
    sexItem: null,
    sexRange: 'all',
    feelOpen: false,
  });
  const panel = cls === 'c4';
  const wide = cls === 'c3' || cls === 'c4';
  const [detail, setDetail] = useState<Detail | null>({ kind: 'consistency' });
  const props: CardProps = { m, v, set: (patch) => setV((x) => ({ ...x, ...patch })), panel, wide, detail, onDetail: setDetail };

  const hero = <ConsistencyCard {...props} />;
  const feel = <FeelCard {...props} />;
  const record = <RecordCard {...props} />;
  const sexual = <SexualCard {...props} />;
  const other = <OtherRecordsCard {...props} />;

  if (!wide) {
    return (
      <>
        {hero}
        {feel}
        {record}
        {sexual}
        {other}
      </>
    );
  }
  const main = (
    <View style={{ gap: GAP, width: '100%', maxWidth: MAIN_MAX, alignSelf: 'center' }}>
      {hero}
      <Side>{[feel, record]}</Side>
      {sexual}
      {other}
    </View>
  );
  if (!panel) return main;
  // The panel stays in view while the page scrolls (web only; native has no c4).
  const sticky = (Platform.OS === 'web' ? { position: 'sticky', top: 0 } : {}) as unknown as ViewStyle;
  return (
    <View style={{ flexDirection: 'row', gap: GAP, alignItems: 'flex-start' }}>
      <View style={{ flex: 1, minWidth: 0, maxWidth: MAIN_MAX }}>{main}</View>
      <View style={[{ width: PANEL_W }, sticky]}>
        <DetailPanel m={m} v={v} detail={detail} wide={wide} />
      </View>
    </View>
  );
}
