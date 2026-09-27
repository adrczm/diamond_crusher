// Progress ring (week target, session progress) and the completion mark that draws itself in when a session ends.
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useReducedMotion } from './motion';
import { motion, useColors } from './theme';

export function Ring({
  value,
  size = 96,
  stroke = 8,
  color,
  track,
  children,
  label,
}: {
  /** 0 to 1. */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  label?: string;
}) {
  const c = useColors();
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <View accessible={!!label} accessibilityLabel={label} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.soft} strokeWidth={stroke} fill="none" />
        {v > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color ?? c.good}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${len} ${len}`}
            strokeDashoffset={len * (1 - v)}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

/**
 * Session complete: a ring closes and a tick draws in, then settles (peak-end: finish on a good moment). A still
 * mark when Reduce motion is on.
 */
export function Celebrate({ size = 120 }: { size?: number }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(reduced ? 1 : 0.85)).current;
  useEffect(() => {
    if (reduced) {
      t.setValue(1);
      pop.setValue(1);
      return;
    }
    const native = Platform.OS !== 'web';
    Animated.parallel([
      Animated.timing(t, { toValue: 1, duration: 900, easing: Easing.bezier(0.19, 0.91, 0.38, 1), useNativeDriver: false }),
      Animated.sequence([Animated.delay(motion.duration['300']), Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: native })]),
    ]).start();
  }, [reduced, t, pop]);
  const stroke = 8;
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const tick = size * 0.9;
  const ringOffset = t.interpolate({ inputRange: [0, 1], outputRange: [len, 0] });
  const tickOffset = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [tick, tick, 0] });
  return (
    <Animated.View accessibilityElementsHidden importantForAccessibility="no" style={{ width: size, height: size, transform: [{ scale: pop }] }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill={c.goodSoft} />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.celebrate}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${len} ${len}`}
          strokeDashoffset={ringOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <AnimatedPolyline
          points={`${size * 0.3},${size * 0.52} ${size * 0.44},${size * 0.66} ${size * 0.71},${size * 0.38}`}
          stroke={c.celebrate}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={`${tick} ${tick}`}
          strokeDashoffset={tickOffset}
        />
      </Svg>
    </Animated.View>
  );
}
