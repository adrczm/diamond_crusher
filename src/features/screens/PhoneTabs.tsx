// Bottom tab bar on phones and narrow windows (UX audit H4): Today, Progress, Log, Library and More (Settings, which
// links to Check-ins, Reminders, Backup and data, Sync and About). It uses the sidebar's names, shows only on the
// top-level sections, and hides in guided flows and while the keyboard is open. The desktop uses the sidebar.
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DESKTOP } from '../../content/en/strings';
import { Icon, type IconName } from '../../ui/icons';
import { phoneTab, TABS, useDesktop, type TabKey } from '../../ui/layout';
import { Text } from '../../ui/text';
import { radius, space, type, useColors } from '../../ui/theme';

const ICON: Record<TabKey, IconName> = { home: 'home', progress: 'progress', log: 'log', library: 'library', more: 'more' };
const label = (k: TabKey) => (k === 'more' ? DESKTOP.more : DESKTOP.nav[k]);

/** Tabs keep a flat history: Today at the root and at most one section above it, so Back always leads to Today. */
function go(href: string) {
  if (router.canDismiss()) router.dismissAll();
  if (href !== '/') router.push(href);
}

function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const a = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return open;
}

export function PhoneTabs() {
  const desktop = useDesktop();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardOpen();
  const c = useColors();
  const active = phoneTab(pathname);
  if (desktop || !active || keyboard) return null;
  return (
    <View
      role="tablist"
      accessibilityLabel={DESKTOP.tabs}
      style={{
        flexDirection: 'row',
        backgroundColor: c.card,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: c.border,
        paddingBottom: insets.bottom,
        paddingHorizontal: space(0.5),
      }}
    >
      {TABS.map((t) => {
        const on = active === t.key;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityLabel={label(t.key)}
            accessibilityState={{ selected: on }}
            onPress={() => {
              // On a page under More (e.g. Check-ins), the lit More tab goes back to Settings.
              if (pathname !== t.href) go(t.href);
            }}
            style={(s) => ({ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2, opacity: s.pressed ? 0.7 : 1 })}
          >
            <View
              style={{
                width: 56,
                height: 28,
                borderRadius: radius.lg,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? c.navSelected : 'transparent',
              }}
            >
              <Icon name={ICON[t.key]} size={22} color={on ? c.text : c.muted} />
            </View>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.5} style={[type('body-sm'), { color: on ? c.text : c.muted, fontWeight: on ? '600' : '400' }]}>
              {label(t.key)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
