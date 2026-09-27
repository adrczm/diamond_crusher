// Small UI kit: large touch targets, plain text, light and dark (spec 05, 09 polish).
import { Stack } from 'expo-router';
import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useColors } from './theme';

export function Screen({
  title,
  children,
  scroll = true,
  footer,
  headerShown = true,
}: {
  title?: string;
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  headerShown?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={{ padding: space(2), paddingBottom: space(4) + (footer ? 0 : insets.bottom), gap: space(2) }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, padding: space(2), gap: space(2) }}>{children}</View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: headerShown ? 0 : insets.top }}>
      <Stack.Screen options={{ title: title ?? '', headerShown }} />
      {body}
      {footer ? (
        <View style={{ padding: space(2), paddingBottom: space(2) + insets.bottom, gap: space(1), borderTopWidth: 1, borderColor: c.border, backgroundColor: c.bg }}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function H1({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: '700', color: c.text, lineHeight: 32 }}>
      {children}
    </Text>
  );
}

export function H2({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <Text accessibilityRole="header" style={{ fontSize: 19, fontWeight: '600', color: c.text, lineHeight: 25 }}>
      {children}
    </Text>
  );
}

export function P({ children, muted, small, center }: { children: ReactNode; muted?: boolean; small?: boolean; center?: boolean }) {
  const c = useColors();
  return (
    <Text style={{ fontSize: small ? 14 : 17, lineHeight: small ? 20 : 24, color: muted ? c.muted : c.text, textAlign: center ? 'center' : 'left' }}>
      {children}
    </Text>
  );
}

export function Label({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={{ fontSize: 13, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{children}</Text>;
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
  const bg = kind === 'primary' ? c.primary : kind === 'danger' ? c.danger : kind === 'secondary' ? c.soft : 'transparent';
  const fg = kind === 'primary' ? c.onPrimary : kind === 'danger' ? '#FFFFFF' : c.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 52,
          borderRadius: 14,
          paddingHorizontal: space(2),
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>{label}</Text>}
    </Pressable>
  );
}

export function Card({ children, onPress, tone = 'normal' }: { children: ReactNode; onPress?: () => void; tone?: 'normal' | 'soft' | 'warn' }) {
  const c = useColors();
  const bg = tone === 'soft' ? c.soft : tone === 'warn' ? c.warnSoft : c.card;
  const inner = <View style={{ gap: space(1) }}>{children}</View>;
  const style = { backgroundColor: bg, borderRadius: 16, padding: space(2), borderWidth: tone === 'normal' ? 1 : 0, borderColor: c.border };
  if (!onPress) return <View style={style}>{inner}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [style, { opacity: pressed ? 0.85 : 1 }]}>
      {inner}
    </Pressable>
  );
}

export function Banner({ text, tone = 'warn' }: { text: string; tone?: 'warn' | 'soft' }) {
  const c = useColors();
  return (
    <View style={{ backgroundColor: tone === 'warn' ? c.warnSoft : c.soft, borderRadius: 12, padding: space(1.5) }}>
      <Text style={{ color: tone === 'warn' ? c.warn : c.text, fontSize: 15, lineHeight: 21 }}>{text}</Text>
    </View>
  );
}

export interface Option<T> {
  value: T;
  label: string;
  hint?: string;
}

/** Single-choice list with large rows (radio semantics). */
export function Choice<T>({ options, value, onChange }: { options: readonly Option<T>[]; value: T | undefined; onChange: (v: T) => void }) {
  const c = useColors();
  return (
    <View style={{ gap: space(1) }} accessibilityRole="radiogroup">
      {options.map((o, i) => {
        const selected = value === o.value;
        return (
          <Pressable
            key={i}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={{
              minHeight: 52,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: selected ? c.primary : c.border,
              backgroundColor: selected ? c.soft : c.card,
              paddingHorizontal: space(2),
              paddingVertical: space(1.25),
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 17, color: c.text, fontWeight: selected ? '600' : '400' }}>{o.label}</Text>
            {o.hint ? <Text style={{ fontSize: 14, color: c.muted, marginTop: 2 }}>{o.hint}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Multi-choice list (checkbox semantics). */
export function MultiChoice<T>({ options, values, onChange }: { options: readonly Option<T>[]; values: readonly T[]; onChange: (v: T[]) => void }) {
  const c = useColors();
  return (
    <View style={{ gap: space(1) }}>
      {options.map((o, i) => {
        const selected = values.includes(o.value);
        return (
          <Pressable
            key={i}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(selected ? values.filter((v) => v !== o.value) : [...values, o.value])}
            style={{
              minHeight: 52,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: selected ? c.primary : c.border,
              backgroundColor: selected ? c.soft : c.card,
              paddingHorizontal: space(2),
              paddingVertical: space(1.25),
              flexDirection: 'row',
              alignItems: 'center',
              gap: space(1.5),
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: selected ? c.primary : c.muted,
                backgroundColor: selected ? c.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selected ? <Text style={{ color: c.onPrimary, fontSize: 14, fontWeight: '700' }}>✓</Text> : null}
            </View>
            <Text style={{ fontSize: 17, color: c.text, flex: 1 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Compact segmented picker for short option sets. */
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
            style={{
              minHeight: 44,
              minWidth: 44,
              paddingHorizontal: space(1.5),
              borderRadius: 22,
              borderWidth: 2,
              borderColor: selected ? c.primary : c.border,
              backgroundColor: selected ? c.primary : c.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: selected ? c.onPrimary : c.text, fontSize: 16, fontWeight: '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: space(1) }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, color: c.text }}>{label}</Text>
        {hint ? <Text style={{ fontSize: 14, color: c.muted }}>{hint}</Text> : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: c.primary, false: c.border }} />
    </View>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const c = useColors();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ fontSize: 15, color: c.muted }}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={c.muted}
        accessibilityLabel={label}
        {...rest}
        style={[
          { minHeight: 52, borderRadius: 12, borderWidth: 2, borderColor: c.border, backgroundColor: c.card, color: c.text, fontSize: 17, paddingHorizontal: space(1.5) },
          style,
        ]}
      />
    </View>
  );
}

export function Stepper({ value, min, max, onChange, suffix }: { value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  const c = useColors();
  const btn = (label: string, d: number, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={value + d < min || value + d > max}
      onPress={() => onChange(Math.max(min, Math.min(max, value + d)))}
      style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center', opacity: value + d < min || value + d > max ? 0.4 : 1 }}
    >
      <Text style={{ fontSize: 24, color: c.primary, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
      {btn('−', -1, 'Less')}
      <Text style={{ fontSize: 22, color: c.text, fontWeight: '600', minWidth: 48, textAlign: 'center' }}>
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
      style={({ pressed }) => ({ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space(1), opacity: pressed ? 0.7 : 1 })}
    >
      <Text style={{ flex: 1, fontSize: 17, color: c.text }}>{label}</Text>
      {detail ? <Text style={{ fontSize: 15, color: c.muted }}>{detail}</Text> : null}
      <Text style={{ fontSize: 20, color: c.muted }}>›</Text>
    </Pressable>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator color={c.primary} size="large" />
    </View>
  );
}

export function Dots({ filled, total, today }: { filled: boolean[]; total: number; today?: number }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }} accessibilityLabel={`${filled.filter(Boolean).length} of ${total} days`}>
      {filled.map((f, i) => (
        <View
          key={i}
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: f ? c.primary : 'transparent',
            borderWidth: 2,
            borderColor: i === today ? c.text : f ? c.primary : c.border,
          }}
        />
      ))}
    </View>
  );
}
