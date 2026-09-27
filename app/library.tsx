// Learn library (05 §5): education screens for your profile, everyday squeezes and your goal add-ons.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { EDUCATION_FOOTER, educationFor } from '../src/content/en/education';
import { addOnsFor, everydaySqueezes } from '../src/content/en/exercise';
import { TODO_BANNER } from '../src/content/en/screening';
import { markContentSeen } from '../src/data/repositories/misc';
import { activeGoals, getProfile } from '../src/data/repositories/profile';
import { DESKTOP } from '../src/content/en/strings';
import { useApp, useLoad } from '../src/features/app';
import { Banner, Card, H1, H2, LinkRow, Loading, P, Screen, type PressState } from '../src/ui/kit';
import { useDesktop } from '../src/ui/layout';
import { Text } from '../src/ui/text';
import { radius, space, type, useColors } from '../src/ui/theme';

export default function Library() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { db } = useApp();
  const desktop = useDesktop();
  const c = useColors();
  const { data } = useLoad(async (d) => ({ profile: await getProfile(d), goals: await activeGoals(d) }));
  useEffect(() => {
    if (id) markContentSeen(db, id).catch(() => undefined);
  }, [db, id]);
  if (!data) return <Loading />;
  const anatomy = data.profile?.anatomy ?? 'other_unspecified';
  const screens = educationFor(anatomy);
  const addOns = addOnsFor(anatomy, data.goals);
  // Desktop: list and article side by side (master-detail), the first article open by default.
  const e = id ? screens.find((s) => s.id === id) : desktop ? screens[0] : null;
  const article = e ? (
    <>
      <H1>{e.title}</H1>
      {e.todo || anatomy === 'female' ? <Banner text={TODO_BANNER} /> : null}
      {(e.id === 'ED-08' ? everydaySqueezes(anatomy) : e.body).map((b, i) => (
        <P key={i}>{b}</P>
      ))}
      {e.id === 'ED-08'
        ? addOns.map((a, i) => (
            <Card key={i}>
              <H2>{a.title}</H2>
              {a.items.map((t, j) => (
                <P key={j}>{`• ${t}`}</P>
              ))}
            </Card>
          ))
        : null}
      <P small muted>
        {EDUCATION_FOOTER}
      </P>
    </>
  ) : null;
  if (desktop && e) {
    return (
      <Screen title={DESKTOP.nav.library} width="wide">
        <View style={{ flexDirection: 'row', gap: space(4), alignItems: 'flex-start' }}>
          <View style={{ width: 280, gap: 2 }} accessibilityRole="menu">
            <Text style={[type('heading-sm'), { color: c.muted, paddingHorizontal: space(1.5), marginBottom: space(1) }]}>{DESKTOP.articles}</Text>
            {screens.map((s) => {
              const on = s.id === e.id;
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: on }}
                  onPress={() => router.setParams({ id: s.id })}
                  style={(st) => ({
                    paddingHorizontal: space(1.5),
                    paddingVertical: space(1),
                    borderRadius: radius.md,
                    backgroundColor: on ? c.card : (st as PressState).hovered ? c.hover : 'transparent',
                    borderWidth: on ? 1 : 0,
                    borderColor: c.border,
                  })}
                >
                  <Text style={[type('body-md'), { color: c.text }, on ? { fontWeight: '600' } : null]}>{s.title}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flex: 1, minWidth: 0, maxWidth: 680, gap: space(2) }}>{article}</View>
        </View>
      </Screen>
    );
  }
  if (e) return <Screen title={e.title}>{article}</Screen>;
  return (
    <Screen title={DESKTOP.nav.library}>
      <Card>
        {screens.map((s) => (
          <LinkRow key={s.id} label={s.title} onPress={() => router.push(`/library?id=${s.id}`)} />
        ))}
      </Card>
      <P small muted>
        {EDUCATION_FOOTER}
      </P>
    </Screen>
  );
}
