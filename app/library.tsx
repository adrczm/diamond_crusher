// Learn library (05 §5): education screens for your profile, everyday squeezes and your goal add-ons.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { EDUCATION_FOOTER, educationFor } from '../src/content/en/education';
import { addOnsFor, everydaySqueezes } from '../src/content/en/exercise';
import { TODO_BANNER } from '../src/content/en/screening';
import { markContentSeen } from '../src/data/repositories/misc';
import { activeGoals, getProfile } from '../src/data/repositories/profile';
import { useApp, useLoad } from '../src/features/app';
import { Banner, Card, H1, H2, LinkRow, Loading, P, Screen } from '../src/ui/kit';

export default function Library() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { db } = useApp();
  const { data } = useLoad(async (d) => ({ profile: await getProfile(d), goals: await activeGoals(d) }));
  useEffect(() => {
    if (id) markContentSeen(db, id).catch(() => undefined);
  }, [db, id]);
  if (!data) return <Loading />;
  const anatomy = data.profile?.anatomy ?? 'other_unspecified';
  const screens = educationFor(anatomy);
  const addOns = addOnsFor(anatomy, data.goals);
  const e = id ? screens.find((s) => s.id === id) : null;
  if (e) {
    const body = e.id === 'ED-08' ? everydaySqueezes(anatomy) : e.body;
    return (
      <Screen title={e.title}>
        <H1>{e.title}</H1>
        {e.todo || anatomy === 'female' ? <Banner text={TODO_BANNER} /> : null}
        {body.map((b, i) => (
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
      </Screen>
    );
  }
  return (
    <Screen title="Learn library">
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
