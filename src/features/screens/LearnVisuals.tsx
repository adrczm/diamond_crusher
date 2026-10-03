// Pictures for Learn the squeeze (UX audit H6): a plain pelvic floor diagram and the lift / let-go circle.
import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Ellipse, Path, Polyline } from 'react-native-svg';
import { LEARN } from '../../content/en/learn';
import { P } from '../../ui/kit';
import { useDesktop } from '../../ui/layout';
import { useReducedMotion } from '../../ui/motion';
import { useColors } from '../../ui/theme';
import { Text } from '../../ui/text';
import { useCountdown } from '../../ui/useCountdown';
import { RELEASE_S } from '../../domain/session/plan';

/**
 * A neutral outline of the pelvis with the pelvic floor as a hammock across the bottom: dashed at rest, solid and
 * higher during a squeeze, with an arrow up. Shapes only, no body detail.
 */
export function PelvicFloorDiagram({ caption = true }: { caption?: boolean }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View accessible accessibilityRole="image" accessibilityLabel={LEARN.diagramAlt}>
        <Svg width={240} height={150} viewBox="0 0 240 150">
          {/* Pelvis walls */}
          <Path d="M30 14 C 28 70, 48 100, 70 112" stroke={c.muted} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Path d="M210 14 C 212 70, 192 100, 170 112" stroke={c.muted} strokeWidth={3} fill="none" strokeLinecap="round" />
          {/* Bladder and bowel it supports */}
          <Ellipse cx={120} cy={62} rx={34} ry={20} fill={c.soft} stroke={c.border} strokeWidth={2} />
          {/* Pelvic floor at rest */}
          <Path d="M70 112 Q 120 146, 170 112" stroke={c.muted} strokeWidth={2} strokeDasharray="6 6" fill="none" />
          {/* Pelvic floor during a squeeze: lifted up and in */}
          <Path d="M70 112 Q 120 110, 170 112" stroke={c.squeeze} strokeWidth={5} fill="none" strokeLinecap="round" />
          {/* Lift arrow */}
          <Path d="M120 142 L 120 96" stroke={c.primary} strokeWidth={3} strokeLinecap="round" />
          <Polyline points="111,103 120,92 129,103" stroke={c.primary} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      {caption ? (
        <>
          <P center>{LEARN.diagramCaption}</P>
          <P small muted center>
            {LEARN.diagramKey}
          </P>
        </>
      ) : null}
    </View>
  );
}

const AnimatedText = Animated.createAnimatedComponent(Text);

/**
 * The session circle, reused with the session's rules (motion 3.3): it swells over 400 ms on a squeeze and settles
 * across the whole 2 s let-go, and its colour fades with it instead of flipping (MO-2, MO-5). The seconds left are
 * inside. Still when Reduce motion is on.
 */
export function LiftCircle({ squeezing, seconds, label, onDone }: { squeezing: boolean; seconds: number; label: string; onDone: () => void }) {
  const c = useColors();
  const desktop = useDesktop();
  const reduced = useReducedMotion();
  const left = useCountdown(seconds, true, onDone);
  // 0 = let go (smaller, grey), 1 = squeezing (full size, blue). Each step mounts at the other end and moves across.
  const k = useRef(new Animated.Value(squeezing ? 0 : 1)).current;
  useEffect(() => {
    const to = squeezing ? 1 : 0;
    if (reduced) k.setValue(to);
    else
      Animated.timing(k, {
        toValue: to,
        // body.recruit: 400 ms ease-out. body.letgo: the whole 2 s let-go, eased like the session circle.
        duration: squeezing ? 400 : Math.min(seconds, RELEASE_S) * 1000,
        easing: squeezing ? Easing.bezier(0.22, 1, 0.36, 1) : Easing.inOut(Easing.sin),
        useNativeDriver: false,
      }).start();
  }, [squeezing, reduced, k, seconds]);
  const D = desktop ? 220 : 180;
  // On a squeeze the colour arrives in the first 150 ms of the 400 ms swell. On the let-go it fades across the 2 s.
  const at = squeezing ? [0, 0.375, 1] : [0, 0.999, 1];
  const scale = k.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const backgroundColor = k.interpolate({ inputRange: at, outputRange: [c.soft, c.squeeze, c.squeeze] });
  const color = k.interpolate({ inputRange: at, outputRange: [c.primary, c.onSqueeze, c.onSqueeze] });
  return (
    <View style={{ alignItems: 'center', paddingVertical: 16, gap: 12 }} accessibilityLiveRegion="polite">
      <Animated.View
        style={{
          width: D,
          height: D,
          borderRadius: D / 2,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale }],
        }}
      >
        <AnimatedText style={{ fontSize: 64, fontWeight: '700', color }}>{left}</AnimatedText>
      </Animated.View>
      <Text style={{ fontSize: 20, color: c.muted, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}
