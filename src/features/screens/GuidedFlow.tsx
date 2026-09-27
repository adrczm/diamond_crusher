// Frame for the guided flows (onboarding, Learn the squeeze, self-check). UX audit H1, H8, M7:
// - phones: content in a column, actions in the bottom bar, and a Close control in the header that asks first;
// - desktop: one centred card with the actions inline under the content, so the pointer travels a short way.
import { router, Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { COMMON, DESKTOP, FLOW } from '../../content/en/strings';
import { Alert } from '../../platform/dialog';
import { useHotkeys } from '../../ui/hotkeys';
import { Screen } from '../../ui/kit';
import { isWeb, useDesktop } from '../../ui/layout';
import { radius, space, type, useColors } from '../../ui/theme';
import { Text } from '../../ui/text';

/** Leaves a guided flow: back where the person came from, or Today when there is no history (a reload). */
export function leaveFlow() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Asks "Leave? This step is not saved." before leaving (H8). */
export function confirmLeave(onLeave: () => void = leaveFlow) {
  Alert.alert(FLOW.leaveTitle, FLOW.leaveBody, [
    { text: COMMON.cancel, style: 'cancel' },
    { text: FLOW.leave, style: 'destructive', onPress: onLeave },
  ]);
}

/**
 * Desktop: Space or Enter runs `run` (H8). Mounted only while there is an action to run, so at other times Space
 * still presses the focused control. Held keys do not repeat the action.
 */
export function HotAction({ run }: { run: () => void }) {
  const desktop = useDesktop();
  const fire = (e: KeyboardEvent) => {
    if (!e.repeat) run();
  };
  useHotkeys({ ' ': fire, Enter: fire }, desktop);
  return null;
}

/** Slim progress bar with "Step X of N" (H1). `step` counts from 1. */
export function StepProgress({ step, total, label }: { step: number; total: number; label: string }) {
  const c = useColors();
  const v = Math.max(0, Math.min(1, step / total));
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: total, now: step }} style={{ gap: space(0.75) }}>
      <Text style={[type('body-sm'), { color: c.muted }]}>{label}</Text>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c.border, overflow: 'hidden' }}>
        <View style={{ width: `${v * 100}%`, height: 4, borderRadius: 2, backgroundColor: c.primary }} />
      </View>
    </View>
  );
}

export function FlowScreen({
  title,
  headerShown = true,
  top,
  actions,
  hotkey,
  onClose,
  children,
}: {
  title: string;
  headerShown?: boolean;
  /** Shown above the content (the progress bar). */
  top?: ReactNode;
  /** Buttons, primary first. Phones: the bottom bar. Desktop: a row under the content. */
  actions?: ReactNode;
  /** Desktop: the action Space or Enter runs (usually the primary button), with a key hint under the actions. */
  hotkey?: (() => void) | null;
  /** Phones: a Close control in the header. Pass `null` to hide it. */
  onClose?: (() => void) | null;
  children: ReactNode;
}) {
  const c = useColors();
  const desktop = useDesktop();
  const close =
    onClose && headerShown && !desktop ? (
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={COMMON.close}
              onPress={onClose}
              hitSlop={12}
              style={{ paddingHorizontal: space(1), minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={[type('heading-md'), { color: c.link }]}>{COMMON.close}</Text>
            </Pressable>
          ),
        }}
      />
    ) : null;

  if (!desktop) {
    return (
      <Screen title={title} headerShown={headerShown} footer={actions}>
        {close}
        {top}
        {children}
      </Screen>
    );
  }

  return (
    <Screen title={title} headerShown={headerShown} scroll={false}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: space(4) }} keyboardShouldPersistTaps="handled">
        <View
          style={{
            width: '100%',
            maxWidth: 640,
            alignSelf: 'center',
            backgroundColor: c.card,
            borderRadius: radius.lg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: c.border,
            padding: space(4),
            gap: space(2.5),
          }}
        >
          {top}
          {children}
          {actions ? <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: space(1), paddingTop: space(1) }}>{actions}</View> : null}
          {hotkey ? <HotAction run={hotkey} /> : null}
          {hotkey && isWeb ? <Text style={[type('body-sm'), { color: c.muted, textAlign: 'right' }]}>{DESKTOP.flowKeys}</Text> : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
