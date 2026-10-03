// The Mac's right panel at the widest layout (c4, Mac decision M3): a titled, closable column beside the page that stays
// in view while the page scrolls. Settings uses it for Reminders (Q3). Esc or Close shuts it.
import { type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { DESKTOP } from '../../content/en/strings';
import { useHotkeys } from '../../ui/hotkeys';
import { Icon } from '../../ui/icons';
import { type PressState } from '../../ui/kit';
import { Text } from '../../ui/text';
import { radius, space, type, useColors } from '../../ui/theme';

/** Panel width: a little wider than Progress's 320 detail panel, as it holds forms (time fields, steppers). */
export const SIDE_PANEL_W = 380;

export function SidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const c = useColors();
  useHotkeys({ Escape: onClose });
  // Web only (native has no c4): sticky to the top, no taller than the window, with its own scroll.
  const sticky = (Platform.OS === 'web' ? { position: 'sticky', top: 0, maxHeight: 'calc(100vh - 64px)' } : {}) as unknown as ViewStyle;
  return (
    <View
      role="complementary"
      aria-label={title}
      style={[
        {
          width: SIDE_PANEL_W,
          backgroundColor: c.bg,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.border,
          overflow: 'hidden',
        },
        sticky,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1), padding: space(1.5), paddingLeft: space(2), backgroundColor: c.card }}>
        <Text accessibilityRole="header" style={[type('heading-md'), { color: c.text, flex: 1 }]}>
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={DESKTOP.close}
          onPress={onClose}
          style={(s) => ({
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.md,
            backgroundColor: (s as PressState).hovered ? c.hover : 'transparent',
          })}
        >
          <Icon name="close" size={20} color={c.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: space(2), gap: space(2) }}>{children}</ScrollView>
    </View>
  );
}
