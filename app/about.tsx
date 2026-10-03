// About (05 CNT-006, CNT-010): what the app is, the disclaimer and licences.
import { router } from 'expo-router';
import { ABOUT, APP_NAME, disclaimerFor, SETTINGS } from '../src/content/en/strings';
import { getProfile } from '../src/data/repositories/profile';
import { useApp, useLoad } from '../src/features/app';
import { Card, H1, H2, LinkRow, P, Screen } from '../src/ui/kit';

export default function About() {
  const { appVersion } = useApp();
  const { data } = useLoad((d) => getProfile(d));
  const anatomy = data?.anatomy ?? null;
  return (
    <Screen title={ABOUT.title}>
      <H1>{APP_NAME}</H1>
      <P>{ABOUT.description}</P>
      <P muted>{SETTINGS.version(appVersion)}</P>
      <Card>
        <H2>{ABOUT.purposeTitle}</H2>
        {ABOUT.purpose.map((t) => (
          <P key={t}>{t}</P>
        ))}
      </Card>
      <Card>
        <P>{disclaimerFor(anatomy)}</P>
      </Card>
      <P>{ABOUT.licences}</P>
      <Card>
        <LinkRow label={ABOUT.evidence} onPress={() => router.push('/library?id=ED-11')} />
      </Card>
    </Screen>
  );
}
