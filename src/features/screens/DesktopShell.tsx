// Desktop frame for wide windows (the Mac version): a persistent sidebar with sections, today's main action and the
// appearance switch, plus app-wide keyboard shortcuts and their help panel. Phones never render this.
import { router, usePathname } from 'expo-router';
import { useContext, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { DESKTOP, HOME } from '../../content/en/strings';
import { updateSettings, type Settings } from '../../data/repositories/settings';
import { setShortcutsEnabled, shortcutsEnabled, useHotkeys } from '../../ui/hotkeys';
import { ToggleRow } from '../../ui/kit';
import { Icon, type IconName } from '../../ui/icons';
import { activeNav, isFocusRoute, isSection, NAV, SIDEBAR_W, useDesktop } from '../../ui/layout';
import { Text } from '../../ui/text';
import { radius, space, ThemePrefContext, type, useColors, useIsDark } from '../../ui/theme';
import { useApp, useLoad } from '../app';
import { planToday } from '../trainingService';

const ORDER: Settings['theme'][] = ['system', 'light', 'dark'];

function useThemeSwitch() {
  const { db, bump } = useApp();
  const pref = useContext(ThemePrefContext);
  const set = async (theme: Settings['theme']) => {
    await updateSettings(db, { theme });
    bump();
  };
  return { pref, set, cycle: () => set(ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length]) };
}

/** Where the sidebar's main button goes today, or null when there is nothing to start. */
function useTodayAction() {
  const { data } = useLoad((d) => planToday(d));
  if (!data) return null;
  if (data.kind === 'learn') return { label: HOME.learnFirst, href: '/learn', done: false };
  if (data.kind === 'relax') return { label: HOME.relaxPractice, href: '/session?relax=1', done: false };
  if (data.kind === 'strength') return { label: DESKTOP.start, href: '/session', done: false };
  if (data.kind === 'day_done') return { label: DESKTOP.start, href: '/session?extra=1', done: true };
  return null;
}

export function DesktopFrame({ children }: { children: ReactNode }) {
  const desktop = useDesktop();
  const pathname = usePathname();
  const c = useColors();
  const focus = isFocusRoute(pathname);
  const showSidebar = desktop && !focus;
  const [help, setHelp] = useState(false);
  const theme = useThemeSwitch();
  const today = useTodayAction();

  useHotkeys(
    {
      '?': () => setHelp((h) => !h),
      Escape: () => {
        if (help) setHelp(false);
        else if (!isSection(pathname) && router.canGoBack()) router.back();
      },
      t: () => void theme.cycle(),
      s: () => {
        if (today && !today.done) router.push(today.href);
      },
      ...Object.fromEntries(NAV.map((n, i) => [String(i + 1), () => router.navigate(n.href)])),
    },
    showSidebar,
  );

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.bg }}>
      {showSidebar ? <Sidebar pathname={pathname} today={today} theme={theme} onHelp={() => setHelp(true)} /> : null}
      <View style={{ flex: 1 }}>{children}</View>
      {showSidebar ? <ShortcutsPanel open={help} onClose={() => setHelp(false)} /> : null}
    </View>
  );
}

function Sidebar({
  pathname,
  today,
  theme,
  onHelp,
}: {
  pathname: string;
  today: ReturnType<typeof useTodayAction>;
  theme: ReturnType<typeof useThemeSwitch>;
  onHelp: () => void;
}) {
  const c = useColors();
  const dark = useIsDark();
  const active = activeNav(pathname);
  const groups = ['train', 'track', 'app'] as const;
  return (
    <View role="navigation" style={{ width: SIDEBAR_W, backgroundColor: c.nav, borderRightWidth: StyleSheet.hairlineWidth, borderColor: c.border }}>
      <ScrollView contentContainerStyle={{ padding: space(1.5), gap: space(2), flexGrow: 1 }}>
        <Brand />
        {today ? <StartButton label={today.label} done={today.done} onPress={() => router.push(today.href)} /> : null}
        {groups.map((g) => (
          <View key={g} style={{ gap: 2 }}>
            <Text style={[type('body-sm'), { color: c.muted, paddingHorizontal: space(1), marginBottom: 2, fontWeight: '600' }]}>{DESKTOP.navGroups[g]}</Text>
            {NAV.map((n, i) =>
              n.group === g ? (
                <NavRow
                  key={n.key}
                  icon={n.key as IconName}
                  label={DESKTOP.nav[n.key]}
                  digit={i + 1}
                  selected={active === n.key}
                  onPress={() => router.navigate(n.href)}
                />
              ) : null,
            )}
          </View>
        ))}
        <View style={{ flex: 1 }} />
        <View style={{ gap: space(1) }}>
          <Text style={[type('body-sm'), { color: c.muted, paddingHorizontal: space(1), fontWeight: '600' }]}>{DESKTOP.theme}</Text>
          <ThemeSwitch pref={theme.pref} onChange={theme.set} dark={dark} />
          <Pressable
            accessibilityRole="button"
            onPress={onHelp}
            style={(s) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space(1),
              padding: space(1),
              borderRadius: radius.md,
              backgroundColor: (s as { hovered?: boolean }).hovered ? c.navHover : 'transparent',
            })}
          >
            <Icon name="keyboard" size={18} color={c.muted} />
            <Text style={[type('body-sm'), { color: c.muted }]}>{DESKTOP.shortcutsHint}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Brand() {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.25), paddingHorizontal: space(1), paddingTop: space(1) }}>
      <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: c.primary, transform: [{ rotate: '45deg' }] }} />
      </View>
      <Text style={[type('heading-md'), { color: c.text }]}>Diamond Crusher</Text>
    </View>
  );
}

function StartButton({ label, done, onPress }: { label: string; done: boolean; onPress: () => void }) {
  const c = useColors();
  if (done) {
    // Day's plan finished: say so instead of pushing for more (MOT-010, no pressure).
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1), padding: space(1.25), borderRadius: radius.lg, backgroundColor: c.goodSoft }}>
        <Icon name="done" size={18} color={c.text} />
        <Text style={[type('body-md'), { color: c.text, fontWeight: '600' }]}>{DESKTOP.todayDone}</Text>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={(s) => {
        const st = s as { hovered?: boolean; pressed: boolean };
        return {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space(1),
          minHeight: 44,
          borderRadius: radius.lg,
          backgroundColor: st.hovered ? c.primaryHover : c.primary,
          transform: [{ scale: st.pressed ? 0.98 : 1 }],
        };
      }}
    >
      <Icon name="play" size={14} color={c.onPrimary} />
      <Text style={[type('heading-sm'), { color: c.onPrimary }]}>{label}</Text>
      <Text style={[type('body-sm'), { color: c.onPrimary, opacity: 0.7 }]}>S</Text>
    </Pressable>
  );
}

function NavRow({ icon, label, digit, selected, onPress }: { icon: IconName; label: string; digit: number; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={(s) => {
        const hovered = (s as { hovered?: boolean }).hovered;
        return {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space(1.25),
          minHeight: 36,
          paddingHorizontal: space(1),
          borderRadius: radius.md,
          backgroundColor: selected ? c.navSelected : hovered ? c.navHover : 'transparent',
        };
      }}
    >
      {(s) => (
        <>
          <Icon name={icon} size={18} color={selected ? c.text : c.muted} />
          <Text style={[type('body-md'), { flex: 1, color: c.text }, selected ? { fontWeight: '600' } : null]}>{label}</Text>
          {(s as { hovered?: boolean }).hovered || selected ? <Text style={[type('body-sm'), { color: c.muted }]}>{digit}</Text> : null}
        </>
      )}
    </Pressable>
  );
}

function ThemeSwitch({ pref, onChange, dark }: { pref: Settings['theme']; onChange: (t: Settings['theme']) => void; dark: boolean }) {
  const c = useColors();
  const icons: Record<Settings['theme'], IconName> = { system: 'auto', light: 'sun', dark: 'moon' };
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={DESKTOP.theme}
      style={{ flexDirection: 'row', backgroundColor: dark ? c.navHover : c.navHover, borderRadius: radius.lg, padding: 3, gap: 2 }}
    >
      {ORDER.map((t) => {
        const on = pref === t;
        return (
          <Pressable
            key={t}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={DESKTOP.themeShort[t]}
            onPress={() => onChange(t)}
            style={(s) => ({
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              minHeight: 32,
              borderRadius: radius.md,
              backgroundColor: on ? c.card : (s as { hovered?: boolean }).hovered ? c.navSelected : 'transparent',
              borderWidth: on ? StyleSheet.hairlineWidth : 0,
              borderColor: c.border,
            })}
          >
            <Icon name={icons[t]} size={14} color={on ? c.text : c.muted} />
            <Text style={[type('body-sm'), { color: on ? c.text : c.muted, fontWeight: on ? '600' : '400' }]}>{DESKTOP.themeShort[t]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ShortcutsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useColors();
  const [on, setOn] = useState(shortcutsEnabled());
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={DESKTOP.close}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center', padding: space(3) }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 460,
            backgroundColor: c.card,
            borderRadius: radius.xl,
            padding: space(3),
            gap: space(2),
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: c.border,
          }}
        >
          <Text accessibilityRole="header" style={[type('heading-lg'), { color: c.text }]}>
            {DESKTOP.shortcutsTitle}
          </Text>
          {DESKTOP.shortcuts.map((s) => (
            <View key={s.keys} style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
              <View style={{ minWidth: 72, alignItems: 'flex-start' }}>
                <Text
                  style={[
                    type('body-sm'),
                    {
                      color: c.text,
                      fontWeight: '600',
                      backgroundColor: c.soft,
                      borderWidth: 1,
                      borderColor: c.border,
                      borderRadius: radius.sm,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    },
                  ]}
                >
                  {s.keys}
                </Text>
              </View>
              <Text style={[type('body-md'), { color: c.text, flex: 1 }]}>{s.what}</Text>
            </View>
          ))}
          <ToggleRow
            label={DESKTOP.shortcutsToggle}
            hint={DESKTOP.shortcutsToggleHint}
            value={on}
            onChange={(v) => {
              setShortcutsEnabled(v);
              setOn(v);
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
