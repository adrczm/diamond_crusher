// Small UI kit styled after Shopify Polaris (cards, buttons, choice lists, banners), with large touch targets and
// plain text, in light and dark (spec 05, 09 polish).
import { router, Stack, usePathname } from 'expo-router';
import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DESKTOP } from '../content/en/strings';
import { Icon } from './icons';
import { isSection, useDesktop } from './layout';
import { useReducedMotion } from './motion';
import { Text } from './text';
import { motion, radius, space, type, useColors, useIsDark } from './theme';

/** Content column width on phones and narrow windows. */
const MAX_WIDTH = 640;

/** Page widths on the desktop layout: forms and guided steps stay readable, dashboards use the room. */
export type PageWidth = 'narrow' | 'regular' | 'medium' | 'wide';
const DESKTOP_WIDTH: Record<PageWidth, number> = { narrow: 640, regular: 760, medium: 960, wide: 1160 };

/** Pointer state from react-native-web's Pressable (not in React Native's types). */
export type PressState = { pressed: boolean; hovered?: boolean; focused?: boolean };

/** Minimum touch target. Polaris buttons are smaller; the specs ask for large targets. */
const TOUCH = 48;

export function Screen({
  title,
  children,
  scroll = true,
  footer,
  headerShown = true,
  width = 'regular',
}: {
  title?: string;
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  headerShown?: boolean;
  /** Desktop only: how wide the page may grow. */
  width?: PageWidth;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const maxWidth = desktop ? DESKTOP_WIDTH[width] : MAX_WIDTH;
  const pad = desktop ? space(4) : space(2);
  const column: ViewStyle = { width: '100%', maxWidth, alignSelf: 'center' };
  const gap = desktop ? space(2.5) : space(2);
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[column, { padding: pad, paddingBottom: pad + space(2) + (footer ? 0 : insets.bottom), gap }]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[column, { flex: 1, padding: pad, gap }]}>{children}</View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: headerShown || desktop ? 0 : insets.top }}>
      <Stack.Screen options={{ title: title ?? '', headerShown: headerShown && !desktop }} />
      {desktop && headerShown ? <Toolbar title={title ?? ''} /> : null}
      <PageIn style={{ flex: 1 }}>{body}</PageIn>
      {footer ? (
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border, backgroundColor: c.card }}>
          <View
            style={[
              column,
              desktop
                ? { paddingHorizontal: pad, paddingVertical: space(1.5), gap: space(1), flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap' }
                : { padding: space(2), paddingBottom: space(2) + insets.bottom, gap: space(1) },
            ]}
          >
            {footer}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Desktop toolbar: the page title, with Back on pages below a sidebar section (macOS window toolbar). */
function Toolbar({ title }: { title: string }) {
  const c = useColors();
  const pathname = usePathname();
  const canBack = router.canGoBack();
  // Below a section: Back. A guided flow opened directly (e.g. after a reload) has no history: Close goes home.
  const action = isSection(pathname) ? null : canBack ? 'back' : 'close';
  return (
    <View
      style={{
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(1),
        paddingHorizontal: space(2),
        backgroundColor: c.bg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: c.border,
      }}
    >
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action === 'back' ? DESKTOP.back : DESKTOP.close}
          onPress={() => (action === 'back' ? router.back() : router.replace('/'))}
          style={(s) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            height: 36,
            paddingLeft: 4,
            paddingRight: space(1.25),
            borderRadius: radius.md,
            backgroundColor: (s as PressState).hovered ? c.hover : 'transparent',
          })}
        >
          <Icon name="back" size={18} color={c.text} />
          <Text style={[type('body-md'), { color: c.text }]}>{action === 'back' ? DESKTOP.back : DESKTOP.close}</Text>
        </Pressable>
      ) : null}
      <Text accessibilityRole="header" numberOfLines={1} style={[type('heading-md'), { color: c.text, flex: 1 }]}>
        {title}
      </Text>
    </View>
  );
}

/** Pages ease in (Polaris motion-duration-200); nothing moves when Reduce motion is on. */
function PageIn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: motion.duration['200'], easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [t]);
  if (reduced) return <View style={style}>{children}</View>;
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
  return <Animated.View style={[style, { opacity: t, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/**
 * Side-by-side columns on the desktop layout, stacked on phones. `ratio` gives each column's share, e.g. [2, 1].
 */
export function Columns({ children, ratio }: { children: ReactNode[]; ratio?: number[] }) {
  const desktop = useDesktop();
  const kids = React.Children.toArray(children).filter(Boolean);
  if (!desktop) return <>{kids}</>;
  return (
    <View style={{ flexDirection: 'row', gap: space(2.5), alignItems: 'flex-start' }}>
      {kids.map((k, i) => (
        <View key={i} style={{ flex: ratio?.[i] ?? 1, minWidth: 0, gap: space(2.5) }}>
          {k}
        </View>
      ))}
    </View>
  );
}

/** A grid of equal cards: two across on desktop, one on phones. */
export function Grid({ children }: { children: ReactNode }) {
  const desktop = useDesktop();
  const kids = React.Children.toArray(children).filter(Boolean);
  if (!desktop) return <>{kids}</>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2.5) }}>
      {kids.map((k, i) => (
        <View key={i} style={{ flexBasis: '47%', flexGrow: 1, minWidth: 320 }}>
          {k}
        </View>
      ))}
    </View>
  );
}

/**
 * Polaris annotated section: on desktop the title and description sit in a left column beside the card, as in
 * Shopify's settings pages; on phones it is a card with a heading.
 */
export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const c = useColors();
  const desktop = useDesktop();
  if (!desktop) {
    return (
      <Card>
        <H2>{title}</H2>
        {description ? <P small muted>{description}</P> : null}
        {children}
      </Card>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: space(4), alignItems: 'flex-start', paddingVertical: space(1) }}>
      <View style={{ width: 240, gap: space(0.5), paddingTop: space(1) }}>
        <Text accessibilityRole="header" style={[type('heading-md'), { color: c.text }]}>
          {title}
        </Text>
        {description ? <Text style={[type('body-sm'), { color: c.muted }]}>{description}</Text> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Card>{children}</Card>
      </View>
    </View>
  );
}

export function H1({ children }: { children: ReactNode }) {
  const c = useColors();
  const desktop = useDesktop();
  return (
    <Text accessibilityRole="header" style={[type(desktop ? 'heading-2xl' : 'heading-xl'), { color: c.text }]}>
      {children}
    </Text>
  );
}

export function H2({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <Text accessibilityRole="header" style={[type('heading-lg'), { color: c.text }]}>
      {children}
    </Text>
  );
}

export function P({ children, muted, small, center }: { children: ReactNode; muted?: boolean; small?: boolean; center?: boolean }) {
  const c = useColors();
  return (
    <Text style={[type(small ? 'body-sm' : 'body-md'), { color: muted ? c.muted : c.text, textAlign: center ? 'center' : 'left' }]}>
      {children}
    </Text>
  );
}

export function Label({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[type('heading-sm'), { color: c.muted }]}>{children}</Text>;
}

export type ButtonKind = 'primary' | 'secondary' | 'danger' | 'quiet';

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  busy,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = kind === 'primary' ? c.primary : kind === 'danger' ? c.danger : kind === 'secondary' ? c.card : 'transparent';
  const fg = kind === 'primary' ? c.onPrimary : kind === 'danger' ? '#FFFFFF' : kind === 'quiet' ? c.link : c.text;
  const border = kind === 'secondary' ? { borderWidth: 1, borderColor: c.inputBorder } : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={(st) => [
        {
          minHeight: TOUCH,
          minWidth: 120,
          borderRadius: radius.lg,
          paddingHorizontal: space(2.5),
          paddingVertical: space(1),
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hoverBg(kind, bg, (st as PressState).hovered && !disabled, c),
          opacity: disabled ? 0.45 : st.pressed ? 0.82 : 1,
          transform: [{ scale: st.pressed && !disabled ? 0.98 : 1 }],
        },
        border,
        kind === 'primary' || kind === 'danger' ? shadow(1) : null,
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[type('heading-md'), { color: fg, textAlign: 'center' }]}>{label}</Text>}
    </Pressable>
  );
}

function hoverBg(kind: ButtonKind, bg: string, hovered: boolean | undefined, c: ReturnType<typeof useColors>): string {
  if (!hovered) return bg;
  if (kind === 'primary') return c.primaryHover;
  if (kind === 'secondary' || kind === 'quiet') return c.hover;
  return bg;
}

/** Polaris card elevation (shadow-100 / shadow-200), approximated for native. */
function shadow(level: 1 | 2): ViewStyle {
  return Platform.select<ViewStyle>({
    android: { elevation: level },
    default: {
      shadowColor: '#1A1A1A',
      shadowOpacity: level === 1 ? 0.07 : 0.12,
      shadowRadius: level === 1 ? 1 : 3,
      shadowOffset: { width: 0, height: level },
    },
  })!;
}

export function Card({ children, onPress, tone = 'normal' }: { children: ReactNode; onPress?: () => void; tone?: 'normal' | 'soft' | 'warn' }) {
  const c = useColors();
  const dark = useIsDark();
  const bg = tone === 'soft' ? c.soft : tone === 'warn' ? c.warnSoft : c.card;
  const inner = <View style={{ gap: space(1.5) }}>{children}</View>;
  const style: StyleProp<ViewStyle> = [
    {
      backgroundColor: bg,
      borderRadius: radius.lg,
      padding: space(2),
      borderWidth: dark || tone !== 'normal' ? StyleSheet.hairlineWidth : 0,
      borderColor: c.border,
    },
    tone === 'normal' && !dark ? shadow(2) : null,
  ];
  if (!onPress) return <View style={style}>{inner}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={(st) => [style, (st as PressState).hovered ? { backgroundColor: tone === 'normal' ? c.hover : c.selected } : null, { opacity: st.pressed ? 0.85 : 1 }]}
    >
      {inner}
    </Pressable>
  );
}

/** Polaris banner: tinted surface with a tone bar. `warn` = warning, `soft` = info. */
export function Banner({ text, tone = 'warn' }: { text: string; tone?: 'warn' | 'soft' }) {
  const c = useColors();
  const warn = tone === 'warn';
  return (
    <View
      accessibilityRole={warn ? 'alert' : undefined}
      style={{ backgroundColor: warn ? c.warnSoft : c.infoSoft, borderRadius: radius.lg, overflow: 'hidden', flexDirection: 'row' }}
    >
      <View style={{ width: 4, backgroundColor: warn ? '#FFB800' : c.release }} />
      <Text style={[type('body-md'), { color: warn ? c.warn : c.info, padding: space(1.5), flex: 1 }]}>{text}</Text>
    </View>
  );
}

export interface Option<T> {
  value: T;
  label: string;
  hint?: string;
}

function Radio({ selected }: { selected: boolean }) {
  const c = useColors();
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: selected ? 6 : 1,
        borderColor: selected ? c.primary : c.inputBorder,
        backgroundColor: selected ? c.onPrimary : c.inputBg,
      }}
    />
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  const c = useColors();
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: checked ? c.primary : c.inputBorder,
        backgroundColor: checked ? c.primary : c.inputBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <Text style={{ color: c.onPrimary, fontSize: 13, lineHeight: 16, fontWeight: '700' }}>✓</Text> : null}
    </View>
  );
}

function ChoiceRow({
  selected,
  role,
  onPress,
  control,
  label,
  hint,
}: {
  selected: boolean;
  role: 'radio' | 'checkbox';
  onPress: () => void;
  control: ReactNode;
  label: string;
  hint?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      onPress={onPress}
      style={(st) => ({
        minHeight: TOUCH + 4,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.primary : (st as PressState).hovered ? c.inputBorder : c.border,
        backgroundColor: selected ? c.selected : (st as PressState).hovered ? c.hover : c.card,
        paddingHorizontal: space(2) - (selected ? 1 : 0),
        paddingVertical: space(1.25),
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(1.5),
        opacity: st.pressed ? 0.85 : 1,
      })}
    >
      {control}
      <View style={{ flex: 1 }}>
        <Text style={[type('body-md'), { color: c.text }, selected ? { fontWeight: '600' } : null]}>{label}</Text>
        {hint ? <Text style={[type('body-sm'), { color: c.muted, marginTop: 2 }]}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Single-choice list with large rows (Polaris ChoiceList, radio semantics). */
export function Choice<T>({ options, value, onChange }: { options: readonly Option<T>[]; value: T | undefined; onChange: (v: T) => void }) {
  return (
    <View style={{ gap: space(1) }} accessibilityRole="radiogroup">
      {options.map((o, i) => {
        const selected = value === o.value;
        return (
          <ChoiceRow
            key={i}
            role="radio"
            selected={selected}
            onPress={() => onChange(o.value)}
            control={<Radio selected={selected} />}
            label={o.label}
            hint={o.hint}
          />
        );
      })}
    </View>
  );
}

/** Multi-choice list (Polaris ChoiceList allowMultiple, checkbox semantics). */
export function MultiChoice<T>({ options, values, onChange }: { options: readonly Option<T>[]; values: readonly T[]; onChange: (v: T[]) => void }) {
  return (
    <View style={{ gap: space(1) }}>
      {options.map((o, i) => {
        const selected = values.includes(o.value);
        return (
          <ChoiceRow
            key={i}
            role="checkbox"
            selected={selected}
            onPress={() => onChange(selected ? values.filter((v) => v !== o.value) : [...values, o.value])}
            control={<Checkbox checked={selected} />}
            label={o.label}
            hint={o.hint}
          />
        );
      })}
    </View>
  );
}

/** Compact segmented picker for short option sets (Polaris segmented button group). */
export function Segments<T>({ options, value, onChange }: { options: readonly Option<T>[]; value: T | undefined; onChange: (v: T) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1) }}>
      {options.map((o, i) => {
        const selected = value === o.value;
        return (
          <Pressable
            key={i}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={(st) => ({
              minHeight: TOUCH - 4,
              minWidth: TOUCH - 4,
              paddingHorizontal: space(1.5),
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: selected ? c.primary : c.inputBorder,
              backgroundColor: selected ? c.primary : (st as PressState).hovered ? c.hover : c.card,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Text style={[type('heading-md'), { color: selected ? c.onPrimary : c.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: TOUCH + 4, gap: space(1) }}>
      <View style={{ flex: 1 }}>
        <Text style={[type('body-md'), { color: c.text }]}>{label}</Text>
        {hint ? <Text style={[type('body-sm'), { color: c.muted }]}>{hint}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: c.good, false: c.border }}
        thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
      />
    </View>
  );
}

/** Polaris TextField: label above, 1px input border, focus ring in the emphasis blue. */
export function Field(props: TextInputProps & { label?: string }) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  const { label, style, onFocus, onBlur, ...rest } = props;
  return (
    <View style={{ gap: space(0.5) }}>
      {label ? <Text style={[type('body-md'), { color: c.text }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={c.muted}
        accessibilityLabel={label}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          type('body-md'),
          {
            minHeight: TOUCH,
            borderRadius: radius.md,
            borderWidth: focused ? 2 : 1,
            borderColor: focused ? c.focus : c.inputBorder,
            backgroundColor: c.inputBg,
            color: c.text,
            paddingHorizontal: space(1.5) - (focused ? 1 : 0),
          },
          style,
        ]}
      />
    </View>
  );
}

export function Stepper({ value, min, max, onChange, suffix }: { value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  const c = useColors();
  const btn = (label: string, d: number, a11y: string) => {
    const off = value + d < min || value + d > max;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        disabled={off}
        onPress={() => onChange(Math.max(min, Math.min(max, value + d)))}
        style={{
          width: TOUCH,
          height: TOUCH,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.inputBorder,
          backgroundColor: c.card,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: off ? 0.4 : 1,
        }}
      >
        <Text style={{ fontSize: 22, lineHeight: 26, color: c.text, fontWeight: '600' }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
      {btn('−', -1, 'Less')}
      <Text style={[type('heading-lg'), { color: c.text, minWidth: 48, textAlign: 'center' }]}>
        {value}
        {suffix ? ` ${suffix}` : ''}
      </Text>
      {btn('+', 1, 'More')}
    </View>
  );
}

export function Row({ children, gap = 1 }: { children: ReactNode; gap?: number }) {
  return <View style={{ flexDirection: 'row', gap: space(gap), alignItems: 'center', flexWrap: 'wrap' }}>{children}</View>;
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: space(0.5) }} />;
}

export function LinkRow({ label, onPress, detail }: { label: string; onPress: () => void; detail?: string }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={(st) => ({
        minHeight: TOUCH + 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(1),
        marginHorizontal: -space(1),
        paddingHorizontal: space(1),
        borderRadius: radius.md,
        backgroundColor: (st as PressState).hovered ? c.hover : 'transparent',
        opacity: st.pressed ? 0.7 : 1,
      })}
    >
      <Text style={[type('body-md'), { flex: 1, color: c.text }]}>{label}</Text>
      {detail ? <Text style={[type('body-sm'), { color: c.muted }]}>{detail}</Text> : null}
      <Text style={{ fontSize: 20, color: c.muted }}>›</Text>
    </Pressable>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator color={c.text} size="large" />
    </View>
  );
}

/** Week dots. With `labels`, each dot gets its day letter underneath and today's letter is bold (H9). */
export function Dots({ filled, total, today, labels, label }: { filled: boolean[]; total: number; today?: number; labels?: string[]; label?: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }} accessible accessibilityLabel={label ?? `${filled.filter(Boolean).length} of ${total} days`}>
      {filled.map((f, i) => (
        <View key={i} style={{ alignItems: 'center', gap: 4 }}>
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: f ? c.good : 'transparent',
              borderWidth: 2,
              borderColor: i === today ? c.text : f ? c.good : c.border,
            }}
          />
          {labels ? (
            <Text style={[type('body-sm'), { color: i === today ? c.text : c.muted, fontWeight: i === today ? '700' : '400' }]}>{labels[i]}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
