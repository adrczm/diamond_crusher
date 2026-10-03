// Small UI kit styled after Shopify Polaris (cards, buttons, choice lists, banners), with large touch targets and
// plain text, in light and dark (spec 05, 09 polish).
import { router, Stack, useFocusEffect, usePathname } from 'expo-router';
import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { A11Y, APP_NAME, COMMON, DESKTOP, ERRORS } from '../content/en/strings';
import { Icon, type IconName } from './icons';
import { contentClass, isSection, TWO_COLUMNS_MIN, useDesktop, usePointerFine, type ContentClass } from './layout';
import { useReducedMotion } from './motion';
import { Text } from './text';
import { motion, radius, space, type, useColors, useIsDark } from './theme';

/** Content column width on phones and narrow windows. */
const MAX_WIDTH = 640;

/** Page widths on the desktop layout: forms and guided steps stay readable, dashboards use the room. */
export type PageWidth = 'narrow' | 'regular' | 'medium' | 'wide';
const DESKTOP_WIDTH: Record<PageWidth, number> = { narrow: 640, regular: 760, medium: 960, wide: 1200 };

/** Pointer state from react-native-web's Pressable (not in React Native's types). */
export type PressState = { pressed: boolean; hovered?: boolean; focused?: boolean };

/** Minimum touch target. Polaris buttons are smaller; the specs ask for large targets. */
const TOUCH = 48;
/** With a mouse or trackpad on a wide window, controls are 36 pt (Mac decision M4, WCAG 2.5.8 minimum is 24). */
const POINTER = 36;

/** Control height: 36 with a fine pointer on the desktop layout, else 48. `large` keeps 48 (the session screen). */
export function useTouch(large?: boolean): number {
  const desktop = useDesktop();
  const fine = usePointerFine();
  return !large && desktop && fine ? POINTER : TOUCH;
}

/** The width the page content really has, measured by Screen (falls back to the window). */
const ContentWidth = createContext<number | null>(null);

export function useContentWidth(): number {
  const measured = useContext(ContentWidth);
  const { width } = useWindowDimensions();
  return measured ?? width;
}

export function useContentClass(): ContentClass {
  return contentClass(useContentWidth());
}

/** The title the native header shows on this screen, or null when there is none (desktop, or header hidden). */
const HeaderTitle = createContext<string | null>(null);

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
  const [measured, setMeasured] = useState<number | null>(null);
  // The page lays out by its own width, not the window's (Mac decision M1).
  const onLayout = (e: { nativeEvent: { layout: { width: number } } }, padded: boolean) => {
    const w = Math.round(e.nativeEvent.layout.width - (padded ? 2 * pad : 0));
    if (w > 0 && w !== measured) setMeasured(w);
  };
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[column, { padding: pad, paddingBottom: pad + space(2) + (footer ? 0 : insets.bottom), gap }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap }} onLayout={(e) => onLayout(e, false)}>
        {children}
      </View>
    </ScrollView>
  ) : (
    <View style={[column, { flex: 1, padding: pad, gap }]} onLayout={(e) => onLayout(e, true)}>
      {children}
    </View>
  );
  const nativeHeader = headerShown && !desktop;
  // The browser tab names the page (WCAG 2.4.2, DS-W7). Only page names, never logged content.
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
    }, [title])
  );
  return (
    <HeaderTitle.Provider value={nativeHeader ? title ?? '' : null}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: headerShown || desktop ? 0 : insets.top }}>
        <Stack.Screen options={{ title: title ?? '', headerShown: nativeHeader }} />
        {desktop && headerShown ? <Toolbar title={title ?? ''} /> : null}
        <ContentWidth.Provider value={measured}>
          <PageIn style={{ flex: 1 }}>{body}</PageIn>
        </ContentWidth.Provider>
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
    </HeaderTitle.Provider>
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
  const wide = useContentWidth() >= TWO_COLUMNS_MIN;
  const kids = React.Children.toArray(children).filter(Boolean);
  if (!wide) return <>{kids}</>;
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

/** A grid of equal cards: two across when the page has room (c3 and up), one otherwise. */
export function Grid({ children }: { children: ReactNode }) {
  const wide = useContentWidth() >= TWO_COLUMNS_MIN;
  const kids = React.Children.toArray(children).filter(Boolean);
  if (!wide) return <>{kids}</>;
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
  const isDesktop = useDesktop();
  const width = useContentWidth();
  const desktop = isDesktop && width >= 720;
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

/** Page heading. Left out when the native header above already shows the same text (UX audit M3). */
export function H1({ children }: { children: ReactNode }) {
  const c = useColors();
  const desktop = useDesktop();
  const header = useContext(HeaderTitle);
  if (header != null && typeof children === 'string' && children.trim() === header.trim()) return null;
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

/** A small group or step title. It is a heading for screen readers (DS-A13). */
export function Label({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <Text accessibilityRole="header" style={[type('heading-sm'), { color: c.muted }]}>
      {children}
    </Text>
  );
}

export type ButtonKind = 'primary' | 'secondary' | 'danger' | 'quiet';

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  busy,
  style,
  accessibilityLabel,
  large,
  icon,
  tone,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Longer name for screen readers when the visible label needs its context (e.g. "Change session 1"). */
  accessibilityLabel?: string;
  /** Keep the 48 pt touch size with a mouse too (the session screen is used at arm's length). */
  large?: boolean;
  /** An icon before the label. */
  icon?: IconName;
  /** `critical`: a red outline and red icon, for a safety control that must stand out without alarming (HE-05). */
  tone?: 'critical';
}) {
  const c = useColors();
  const touch = useTouch(large);
  const bg = kind === 'primary' ? c.primary : kind === 'danger' ? c.danger : kind === 'secondary' ? c.card : 'transparent';
  const fg = kind === 'primary' ? c.onPrimary : kind === 'danger' ? '#FFFFFF' : kind === 'quiet' ? c.link : c.text;
  const border = kind === 'secondary' ? { borderWidth: tone === 'critical' ? 2 : 1, borderColor: tone === 'critical' ? c.danger : c.inputBorder } : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled || !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={(st) => [
        {
          minHeight: touch,
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
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : icon ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
          <Icon name={icon} size={18} color={tone === 'critical' ? c.danger : fg} />
          <Text style={[type('heading-md'), { color: fg, textAlign: 'center' }]}>{label}</Text>
        </View>
      ) : (
        <Text style={[type('heading-md'), { color: fg, textAlign: 'center' }]}>{label}</Text>
      )}
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

export type BannerTone = 'warn' | 'soft' | 'critical' | 'success';

/**
 * Polaris banner: tinted surface, tone bar and icon. `warn` = warning, `soft` = information, `critical` = something failed,
 * `success` = something worked. The icon and a spoken prefix carry the tone, so colour is never the only cue (DS-A11).
 * Only `critical` interrupts a screen reader; the others are read politely when they appear (DS-A12).
 */
export function Banner({ text, tone = 'warn' }: { text: string; tone?: BannerTone }) {
  const c = useColors();
  const look = {
    warn: { bg: c.warnSoft, fg: c.warn, bar: '#FFB800', icon: 'alert' as const, prefix: A11Y.warning },
    critical: { bg: c.dangerSoft, fg: c.text, bar: c.danger, icon: 'alert' as const, prefix: A11Y.error },
    success: { bg: c.goodSoft, fg: c.text, bar: c.good, icon: 'done' as const, prefix: '' },
    soft: { bg: c.infoSoft, fg: c.info, bar: c.release, icon: 'info' as const, prefix: '' },
  }[tone];
  return (
    <View
      accessible
      accessibilityRole={tone === 'critical' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'critical' ? 'assertive' : 'polite'}
      accessibilityLabel={look.prefix ? `${look.prefix}: ${text}` : text}
      style={{ backgroundColor: look.bg, borderRadius: radius.lg, overflow: 'hidden', flexDirection: 'row' }}
    >
      <View style={{ width: 4, backgroundColor: look.bar }} />
      <View style={{ paddingLeft: space(1.5), paddingTop: space(1.5) + 2 }}>
        <Icon name={look.icon} size={18} color={look.fg} />
      </View>
      <Text style={[type('body-md'), { color: look.fg, padding: space(1.5), paddingLeft: space(1), flex: 1 }]}>{text}</Text>
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
  const touch = useTouch();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      onPress={onPress}
      style={(st) => ({
        minHeight: touch + 4,
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
export function Choice<T>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly Option<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  /** The question, for screen readers (DS-A4). */
  label?: string;
}) {
  return (
    <View style={{ gap: space(1) }} accessibilityRole="radiogroup" accessibilityLabel={label}>
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
export function MultiChoice<T>({
  options,
  values,
  onChange,
  label,
}: {
  options: readonly Option<T>[];
  values: readonly T[];
  onChange: (v: T[]) => void;
  /** The question, for screen readers (DS-A4). */
  label?: string;
}) {
  return (
    <View style={{ gap: space(1) }} accessibilityRole={label ? 'list' : undefined} accessibilityLabel={label}>
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
export function Segments<T>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly Option<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  /** The question, for screen readers (DS-A4). */
  label?: string;
}) {
  const c = useColors();
  const touch = useTouch();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1) }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o, i) => {
        const selected = value === o.value;
        return (
          <Pressable
            key={i}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={(st) => ({
              minHeight: touch - 4,
              minWidth: touch - 4,
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

/**
 * A labelled switch. The whole row is the target (UX audit M1): tap the label or the switch. The track is drawn here, not
 * with the platform Switch, so the off colour meets 3:1 (controlOff) and there is one focus stop on the web.
 */
export function ToggleRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const c = useColors();
  const touch = useTouch();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={(st) => ({
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: touch + 4,
        gap: space(1),
        marginHorizontal: -space(1),
        paddingHorizontal: space(1),
        borderRadius: radius.md,
        backgroundColor: (st as PressState).hovered ? c.hover : 'transparent',
        opacity: st.pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text style={[type('body-md'), { color: c.text }]}>{label}</Text>
        {hint ? <Text style={[type('body-sm'), { color: c.muted }]}>{hint}</Text> : null}
      </View>
      <View
        style={{
          width: 48,
          height: 28,
          borderRadius: 14,
          padding: 3,
          backgroundColor: value ? c.good : c.controlOff,
          alignItems: value ? 'flex-end' : 'flex-start',
          justifyContent: 'center',
        }}
      >
        <View style={[{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' }, shadow(1)]} />
      </View>
    </Pressable>
  );
}

/** Polaris TextField: label above, 1px input border, focus ring in the emphasis blue. */
export function Field(props: TextInputProps & { label?: string }) {
  const c = useColors();
  const touch = useTouch();
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
            minHeight: touch,
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

export function Stepper({
  value,
  min,
  max,
  onChange,
  suffix,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
  /** What the number is, for screen readers: the buttons read "Less: <label>" (DS-A4). */
  label?: string;
}) {
  const c = useColors();
  const touch = useTouch();
  const btn = (label: string, d: number, a11y: string) => {
    const off = value + d < min || value + d > max;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? `${a11y}: ${label}` : a11y}
        accessibilityState={{ disabled: off }}
        disabled={off}
        onPress={() => onChange(Math.max(min, Math.min(max, value + d)))}
        style={{
          width: touch,
          height: touch,
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
      {btn('−', -1, A11Y.less)}
      <Text accessibilityLiveRegion="polite" style={[type('heading-lg'), { color: c.text, minWidth: 48, textAlign: 'center' }]}>
        {value}
        {suffix ? ` ${suffix}` : ''}
      </Text>
      {btn('+', 1, A11Y.more)}
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
  const touch = useTouch();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={(st) => ({
        minHeight: touch + 4,
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
      <Icon name="chevron" size={18} color={c.muted} />
    </Pressable>
  );
}

/** Spinner while a page loads. With `error`, it says the page did not load and offers Try again (DS-E13). */
export function Loading({ error, onRetry }: { error?: unknown; onRetry?: () => void } = {}) {
  const c = useColors();
  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, padding: space(3), gap: space(2) }}>
        <Banner tone="critical" text={ERRORS.loadFailed} />
        {onRetry ? <Button label={COMMON.tryAgain} onPress={onRetry} /> : null}
      </View>
    );
  }
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

/** Web arrow-key handler for a row of choices: ← → (and Home/End) move between them (WCAG 2.1.1, ARIA tabs pattern). */
function arrowKeys<T>(values: readonly T[], value: T | undefined, onChange: (v: T) => void) {
  return (e: { key?: string; nativeEvent?: { key?: string }; preventDefault?: () => void }) => {
    const key = e.key ?? e.nativeEvent?.key;
    const i = Math.max(0, values.indexOf(value as T));
    const next = key === 'ArrowRight' ? i + 1 : key === 'ArrowLeft' ? i - 1 : key === 'Home' ? 0 : key === 'End' ? values.length - 1 : null;
    if (next == null || next < 0 || next >= values.length || next === i) return;
    e.preventDefault?.();
    onChange(values[next]);
  };
}

/**
 * Underline tabs that switch the view of one card (Progress range, Lying / Standing). Tabs, not choice pills, because
 * they change what is shown, not an answer (round 2 Progress decision P1). role tablist, arrow keys on the web.
 */
export function Tabs<T>({ options, value, onChange, label }: { options: readonly Option<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  const c = useColors();
  const touch = useTouch();
  const onKey = arrowKeys(
    options.map((o) => o.value),
    value,
    onChange
  );
  return (
    <View role="tablist" aria-label={label} accessibilityLabel={label} style={{ flexDirection: 'row', gap: space(2), borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border }}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <Pressable
            key={i}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            {...({ onKeyDown: onKey, tabIndex: on ? 0 : -1 } as object)}
            style={(st) => ({
              minHeight: Math.min(touch, 44),
              justifyContent: 'center',
              borderBottomWidth: 2,
              borderColor: on ? c.text : 'transparent',
              marginBottom: -StyleSheet.hairlineWidth,
              opacity: st.pressed ? 0.7 : 1,
            })}
          >
            <Text style={[type('body-md'), { color: on ? c.text : c.muted, fontWeight: on ? '600' : '400' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A small segmented control that switches between two or three views (Ring · Wave, Path · Rings). The Mac uses it in
 * place of a swipe, which Safari keeps for Back and Forward (Mac decision, 02-desktop-patterns 1.1).
 */
export function ViewSwitch<T>({ options, value, onChange, label }: { options: readonly Option<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  const c = useColors();
  const onKey = arrowKeys(
    options.map((o) => o.value),
    value,
    onChange
  );
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: c.soft, borderRadius: radius.lg, padding: 3, gap: 2 }}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <Pressable
            key={i}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            {...({ onKeyDown: onKey } as object)}
            style={(st) => ({
              minHeight: 32,
              paddingHorizontal: space(1.5),
              justifyContent: 'center',
              borderRadius: radius.md,
              backgroundColor: on ? c.card : (st as PressState).hovered ? c.hover : 'transparent',
              borderWidth: on ? StyleSheet.hairlineWidth : 0,
              borderColor: c.border,
            })}
          >
            <Text style={[type('body-sm'), { color: on ? c.text : c.muted, fontWeight: on ? '600' : '400' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface PagerPage<T> {
  value: T;
  label: string;
  render: () => ReactNode;
}

/**
 * Two or more views of the same thing. On phones: swipe sideways, or tap the dots under it. On the desktop layout: a
 * ViewSwitch above it and no swipe. Only the current page is read by screen readers.
 */
export function Pager<T>({ pages, value, onChange, label }: { pages: readonly PagerPage<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  const c = useColors();
  const desktop = useDesktop();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const ref = useRef<ScrollView>(null);
  const index = Math.max(
    0,
    pages.findIndex((p) => p.value === value)
  );
  useEffect(() => {
    if (!desktop && w > 0) ref.current?.scrollTo({ x: index * w, animated: !reduced });
  }, [index, w, desktop, reduced]);
  if (desktop) {
    return (
      <View style={{ gap: space(1.5) }}>
        <ViewSwitch options={pages.map((p) => ({ value: p.value, label: p.label }))} value={value} onChange={onChange} label={label} />
        {pages[index]?.render()}
      </View>
    );
  }
  const settle = (x: number) => {
    if (w <= 0) return;
    const i = Math.max(0, Math.min(pages.length - 1, Math.round(x / w)));
    if (i !== index) onChange(pages[i].value);
  };
  return (
    <View style={{ gap: space(1) }} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={label}
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
        onScrollEndDrag={(e) => (Platform.OS === 'web' ? settle(e.nativeEvent.contentOffset.x) : undefined)}
        scrollEventThrottle={16}
      >
        {pages.map((p, i) => (
          <View
            key={i}
            style={{ width: w || undefined }}
            accessibilityElementsHidden={i !== index}
            importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}
          >
            {p.render()}
          </View>
        ))}
      </ScrollView>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', justifyContent: 'center' }}>
        {pages.map((p, i) => {
          const on = i === index;
          return (
            <Pressable
              key={i}
              accessibilityRole="radio"
              accessibilityLabel={p.label}
              accessibilityState={{ selected: on }}
              onPress={() => onChange(p.value)}
              hitSlop={8}
              style={{ paddingHorizontal: 8, paddingVertical: 10 }}
            >
              <View style={{ width: on ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: on ? c.text : c.inputBorder }} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
