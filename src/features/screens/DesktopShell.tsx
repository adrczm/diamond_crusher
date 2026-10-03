// Desktop frame for wide windows (the Mac version): a persistent sidebar with sections, today's main action, the
// backup status and the appearance switch, plus app-wide keyboard shortcuts and their help panel. Phones never render
// this (they get PhoneTabs instead). Round 2 (Mac decision M1): 768 to 1039 wide gets a 72 pt icon rail; from 1040 the
// 240 pt sidebar, which ⌘\ or its button folds into the rail (remembered in this browser).
import { router, usePathname } from 'expo-router';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { APP_NAME, DESKTOP, HOME } from '../../content/en/strings';
import { getMeta } from '../../data/repositories/misc';
import { updateSettings, type Settings } from '../../data/repositories/settings';
import { backupAgeDays, backupState } from '../../domain/backup';
import { toLocalDate } from '../../domain/dates';
import { setShortcutsEnabled, shortcutsEnabled, useHotkeys } from '../../ui/hotkeys';
import { ToggleRow } from '../../ui/kit';
import { Icon, type IconName } from '../../ui/icons';
import { activeNav, isFocusRoute, isSection, NAV, RAIL_W, SIDEBAR_W, useDesktop, useWindowClass } from '../../ui/layout';
import { Text } from '../../ui/text';
import { useReducedMotion } from '../../ui/motion';
import { radius, space, ThemePrefContext, type, useColors, useIsDark } from '../../ui/theme';
import { openSessionOnce, useApp, useLoad } from '../app';
import { planToday } from '../trainingService';
import { LogForm } from './LogForm';
import { feedback } from '../../platform/feedback';

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

/** Days since the last backup file (null: never), on the web only, where the browser can lose the data (C3). */
function useBackup() {
  const { data } = useLoad(async (d) => (Platform.OS === 'web' ? ((await getMeta(d))?.last_export_at ?? '') : null));
  if (data == null) return null;
  const last = data ? toLocalDate(new Date(data)) : null;
  const today = toLocalDate(new Date());
  return { age: backupAgeDays(last, today), warn: backupState('web', last, today) !== 'ok' };
}

/** Opens today's action. A key press or click is the gesture that lets the browser play session sounds (M6). */
function openToday(href: string) {
  const go = () => {
    void feedback.prepare().catch(() => undefined);
    router.push(href);
  };
  if (href.startsWith('/session')) openSessionOnce(go);
  else go();
}

/** Where the sidebar's main button goes today, or null when there is nothing to start. */
function useTodayAction() {
  const { data } = useLoad((d) => planToday(d));
  if (!data) return null;
  if (data.kind === 'learn') return { label: HOME.learnFirst, href: '/learn', done: false };
  if (data.kind === 'relax') return { label: HOME.relaxPractice, href: '/session?relax=1', done: false };
  if (data.kind === 'strength') return { label: DESKTOP.start, href: '/session?go=1', done: false };
  if (data.kind === 'day_done') return { label: DESKTOP.start, href: '/session?extra=1', done: true };
  return null;
}

const RAIL_STORE = 'dc-sidebar';

/** The sidebar folded into the rail by choice (large windows). Remembered in this browser, like the text size. */
function useCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return Platform.OS === 'web' && typeof localStorage !== 'undefined' && localStorage.getItem(RAIL_STORE) === 'rail';
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setCollapsed((v) => {
      try {
        localStorage.setItem(RAIL_STORE, v ? 'full' : 'rail');
      } catch {
        // Not remembered.
      }
      return !v;
    });
  return [collapsed, toggle];
}

/** ⌘\ (or Ctrl+\) folds and unfolds the sidebar, as in Safari and Finder. */
function useToggleKey(toggle: () => void, enabled: boolean) {
  const ref = useRef(toggle);
  ref.current = toggle;
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        ref.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
}

export function DesktopFrame({ children }: { children: ReactNode }) {
  const desktop = useDesktop();
  const size = useWindowClass();
  const pathname = usePathname();
  const c = useColors();
  const focus = isFocusRoute(pathname);
  const showSidebar = desktop && !focus;
  const [collapsed, toggleCollapsed] = useCollapsed();
  // Medium windows always get the rail; large ones get the sidebar unless it was folded.
  const rail = size === 'medium' || collapsed;
  const [help, setHelp] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const theme = useThemeSwitch();
  const today = useTodayAction();
  useToggleKey(toggleCollapsed, showSidebar && size !== 'medium');

  // While the shortcuts panel is open, only ? and Esc work, so nothing changes behind it.
  useHotkeys(
    {
      '?': () => setHelp((h) => !h),
      Escape: () => {
        if (help) setHelp(false);
        else if (!isSection(pathname) && router.canGoBack()) router.back();
      },
      ...(help
        ? {}
        : {
            t: () => void theme.cycle(),
            s: () => {
              if (today && !today.done) openToday(today.href);
            },
            // M5: L logs something from any page, in a panel over it.
            // On the Log page the form is already open (and a second form would add a second ⌘↵).
            l: () => {
              if (pathname !== '/log') setLogOpen(true);
            },
            ...Object.fromEntries(NAV.map((n, i) => [String(i + 1), () => router.navigate(n.href)])),
          }),
    },
    showSidebar && !logOpen,
  );

  // Today has its own Start button; a second one in the sidebar would repeat it (Mac critique, today-1280).
  const start = pathname === '/' ? null : today;
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.bg }}>
      {showSidebar && rail ? (
        <Rail
          pathname={pathname}
          today={start}
          theme={theme}
          onHelp={() => setHelp(true)}
          onExpand={size === 'medium' ? null : toggleCollapsed}
        />
      ) : null}
      {showSidebar && !rail ? <Sidebar pathname={pathname} today={start} theme={theme} onHelp={() => setHelp(true)} onCollapse={toggleCollapsed} /> : null}
      <View style={{ flex: 1 }}>{children}</View>
      {showSidebar ? <ShortcutsPanel open={help} onClose={() => setHelp(false)} /> : null}
      {showSidebar ? <LogPanel open={logOpen} onClose={() => setLogOpen(false)} /> : null}
    </View>
  );
}

/** The narrow rail: an icon and a short name per section, with the shortcut in the tooltip. */
function Rail({
  pathname,
  today,
  theme,
  onHelp,
  onExpand,
}: {
  pathname: string;
  today: ReturnType<typeof useTodayAction>;
  theme: ReturnType<typeof useThemeSwitch>;
  onHelp: () => void;
  onExpand: (() => void) | null;
}) {
  const c = useColors();
  const active = activeNav(pathname);
  const backup = useBackup();
  const themeIcon: Record<Settings['theme'], IconName> = { system: 'auto', light: 'sun', dark: 'moon' };
  return (
    <View role="navigation" style={{ width: RAIL_W, backgroundColor: c.nav, borderRightWidth: StyleSheet.hairlineWidth, borderColor: c.border }}>
      <ScrollView contentContainerStyle={{ paddingVertical: space(1.5), paddingHorizontal: 4, gap: space(1), flexGrow: 1, alignItems: 'stretch' }}>
        <View style={{ alignItems: 'center', paddingVertical: space(0.5) }}>
          {onExpand ? (
            <RailButton icon="sidebar" label={DESKTOP.expand} hint={`${DESKTOP.expand} (⌘\\)`} onPress={onExpand} />
          ) : (
            <View style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: c.primary, transform: [{ rotate: '45deg' }], marginVertical: 8 }} />
          )}
        </View>
        {today && !today.done ? (
          <Pressable
            ref={webHint(`${today.label} (S)`, 's')}
            accessibilityRole="button"
            accessibilityLabel={today.label}
            onPress={() => openToday(today.href)}
            style={(st) => ({
              alignSelf: 'center',
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: (st as { hovered?: boolean }).hovered ? c.primaryHover : c.primary,
            })}
          >
            <Icon name="play" size={16} color={c.onPrimary} />
          </Pressable>
        ) : null}
        {NAV.map((n, i) => {
          const selected = active === n.key;
          return (
            <Pressable
              key={n.key}
              ref={webHint(DESKTOP.keyHint(i + 1), String(i + 1))}
              accessibilityRole="link"
              accessibilityLabel={DESKTOP.nav[n.key]}
              accessibilityState={{ selected }}
              onPress={() => router.navigate(n.href)}
              style={(st) => ({
                alignItems: 'center',
                gap: 2,
                paddingVertical: 6,
                borderRadius: radius.md,
                backgroundColor: selected ? c.navSelected : (st as { hovered?: boolean }).hovered ? c.navHover : 'transparent',
              })}
            >
              <Icon name={n.key as IconName} size={20} color={selected ? c.text : c.muted} />
              <Text numberOfLines={2} maxFontSizeMultiplier={1} style={[type('body-sm'), { fontSize: 11, lineHeight: 14, color: c.text, textAlign: 'center', fontWeight: selected ? '600' : '400' }]}>
                {DESKTOP.navShort[n.key]}
              </Text>
            </Pressable>
          );
        })}
        <View style={{ flex: 1 }} />
        {backup ? (
          <RailButton
            icon="data"
            label={DESKTOP.lastBackup(backup.age)}
            hint={DESKTOP.lastBackup(backup.age)}
            onPress={() => router.navigate('/data')}
            warn={backup.warn}
          />
        ) : null}
        <RailButton icon={themeIcon[theme.pref]} label={`${DESKTOP.theme}: ${DESKTOP.themeShort[theme.pref]}`} hint={`${DESKTOP.theme} (T)`} onPress={() => void theme.cycle()} />
        <RailButton icon="keyboard" label={DESKTOP.shortcutsTitle} hint={DESKTOP.shortcutsHint} onPress={onHelp} />
      </ScrollView>
    </View>
  );
}

function RailButton({ icon, label, hint, onPress, warn }: { icon: IconName; label: string; hint: string; onPress: () => void; warn?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      ref={webHint(hint, '')}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(st) => ({
        alignSelf: 'center',
        width: 44,
        height: 40,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: (st as { hovered?: boolean }).hovered ? c.navHover : warn ? c.warnSoft : 'transparent',
      })}
    >
      <Icon name={icon} size={20} color={warn ? c.warn : c.muted} />
    </Pressable>
  );
}

function Sidebar({
  pathname,
  today,
  theme,
  onHelp,
  onCollapse,
}: {
  pathname: string;
  today: ReturnType<typeof useTodayAction>;
  theme: ReturnType<typeof useThemeSwitch>;
  onHelp: () => void;
  onCollapse: () => void;
}) {
  const c = useColors();
  const dark = useIsDark();
  const active = activeNav(pathname);
  const groups = ['train', 'track', 'app'] as const;
  const backup = useBackup();
  return (
    <View role="navigation" style={{ width: SIDEBAR_W, backgroundColor: c.nav, borderRightWidth: StyleSheet.hairlineWidth, borderColor: c.border }}>
      <ScrollView contentContainerStyle={{ padding: space(1.5), gap: space(2), flexGrow: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Brand />
          </View>
          <RailButton icon="sidebar" label={DESKTOP.collapse} hint={`${DESKTOP.collapse} (⌘\\)`} onPress={onCollapse} />
        </View>
        {today ? <StartButton label={today.label} done={today.done} onPress={() => openToday(today.href)} /> : null}
        {groups.map((g) => (
          <View key={g} style={{ gap: 2 }}>
            <Text style={[type('body-sm'), { color: c.muted, paddingHorizontal: space(1), marginBottom: 2, fontWeight: '600' }]}>{DESKTOP.navGroups[g]}</Text>
            {NAV.map((n, i) =>
              n.group === g ? (
                <NavRow
                  key={n.key}
                  icon={n.key as IconName}
                  label={DESKTOP.nav[n.key]}
                  shortcut={i + 1}
                  selected={active === n.key}
                  onPress={() => router.navigate(n.href)}
                />
              ) : null,
            )}
          </View>
        ))}
        <View style={{ flex: 1 }} />
        <View style={{ gap: space(1) }}>
          {backup ? <BackupStatus age={backup.age} warn={backup.warn} selected={active === 'data'} /> : null}
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
      <Text style={[type('heading-md'), { color: c.text }]}>{APP_NAME}</Text>
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

/** Sets a native browser tooltip and aria-keyshortcuts on a web element (react-native-web does not pass them on). */
function webHint(title: string, keys: string) {
  return (el: unknown) => {
    const node = el as HTMLElement | null;
    if (Platform.OS !== 'web' || !node?.setAttribute) return;
    if (shortcutsEnabled()) {
      node.setAttribute('title', title);
      node.setAttribute('aria-keyshortcuts', keys);
    } else {
      node.removeAttribute('title');
      node.removeAttribute('aria-keyshortcuts');
    }
  };
}

// M4: the shortcut digit shows only in the tooltip and the ? panel, as a key, so it never reads like a count.
function NavRow({ icon, label, shortcut, selected, onPress }: { icon: IconName; label: string; shortcut: number; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      ref={webHint(DESKTOP.keyHint(shortcut), String(shortcut))}
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
      <Icon name={icon} size={18} color={selected ? c.text : c.muted} />
      <Text style={[type('body-md'), { flex: 1, color: c.text }, selected ? { fontWeight: '600' } : null]}>{label}</Text>
    </Pressable>
  );
}

/** Calm, always-there backup status at the foot of the sidebar; amber only when there is no file or it is old (C3). */
function BackupStatus({ age, warn, selected }: { age: number | null; warn: boolean; selected: boolean }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityHint={DESKTOP.nav.data}
      onPress={() => router.navigate('/data')}
      style={(s) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(1),
        minHeight: 36,
        paddingHorizontal: space(1),
        borderRadius: radius.md,
        backgroundColor: selected ? c.navSelected : (s as { hovered?: boolean }).hovered ? c.navHover : warn ? c.warnSoft : 'transparent',
      })}
    >
      <Icon name="data" size={18} color={warn ? c.warn : c.muted} />
      <Text style={[type('body-sm'), { color: warn ? c.warn : c.muted, flex: 1 }]}>{DESKTOP.lastBackup(age)}</Text>
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

/** Keeps Tab and Shift+Tab inside the open panel, and puts focus on its Close button when it opens (M12). */
function useFocusTrap(open: boolean, box: React.RefObject<View | null>, first: React.RefObject<View | null>) {
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const start = setTimeout(() => (first.current as unknown as HTMLElement | null)?.focus?.(), 50);
    const onKey = (e: KeyboardEvent) => {
      const root = box.current as unknown as HTMLElement | null;
      if (e.key !== 'Tab' || !root?.querySelectorAll) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>('[tabindex="0"], button, input, a[href]')).filter((el) => !el.hasAttribute('disabled'));
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === -1 || i === items.length - 1 ? 0 : i + 1;
      e.preventDefault();
      items[next].focus();
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(start);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, box, first]);
}

function ShortcutsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useColors();
  const [on, setOn] = useState(shortcutsEnabled());
  const box = useRef<View>(null);
  const closeButton = useRef<View>(null);
  const reduced = useReducedMotion();
  useFocusTrap(open, box, closeButton);
  return (
    <Modal visible={open} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(3) }}>
        {/* The dimmed backdrop closes the panel on a click, but is not a Tab stop: the Close button does that job. */}
        <Pressable
          focusable={false}
          accessible={false}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: '#00000066' }]}
        />
        <View
          ref={box}
          role="dialog"
          aria-modal
          aria-label={DESKTOP.shortcutsTitle}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
            <Text accessibilityRole="header" style={[type('heading-lg'), { color: c.text, flex: 1 }]}>
              {DESKTOP.shortcutsTitle}
            </Text>
            <Pressable
              ref={closeButton}
              accessibilityRole="button"
              accessibilityLabel={DESKTOP.close}
              onPress={onClose}
              style={(s) => ({
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                backgroundColor: (s as { hovered?: boolean }).hovered ? c.hover : 'transparent',
              })}
            >
              <Icon name="close" size={20} color={c.text} />
            </Pressable>
          </View>
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
        </View>
      </View>
    </Modal>
  );
}

/** M5: the Log form in a centred panel over the current page. Esc or Close shuts it; saving shuts it too. */
function LogPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useColors();
  const box = useRef<View>(null);
  const closeButton = useRef<View>(null);
  const reduced = useReducedMotion();
  useFocusTrap(open, box, closeButton);
  useHotkeys({ Escape: onClose }, open);
  if (!open) return null;
  return (
    <Modal visible transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(3) }}>
        <Pressable focusable={false} accessible={false} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: '#00000066' }]} />
        <View
          ref={box}
          role="dialog"
          aria-modal
          aria-label={DESKTOP.quickLog}
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 640,
            maxHeight: '90%',
            backgroundColor: c.bg,
            borderRadius: radius.xl,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: c.border,
            overflow: 'hidden',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1), padding: space(2), paddingBottom: space(1), backgroundColor: c.card }}>
            <Text accessibilityRole="header" style={[type('heading-lg'), { color: c.text, flex: 1 }]}>
              {DESKTOP.quickLog}
            </Text>
            <Pressable
              ref={closeButton}
              accessibilityRole="button"
              accessibilityLabel={DESKTOP.close}
              onPress={onClose}
              style={(s) => ({
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                backgroundColor: (s as { hovered?: boolean }).hovered ? c.hover : 'transparent',
              })}
            >
              <Icon name="close" size={20} color={c.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: space(2), gap: space(2) }}>
            <LogForm onDone={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

