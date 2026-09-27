// Monthly check and 12-week review hub (06b §3.3): parts can be done separately.
import { router } from 'expo-router';
import { useState } from 'react';
import { EVENTS } from '../src/content/en/items';
import { BUNDLE, COMMON, DATA } from '../src/content/en/strings';
import { REVIEW_12W_CARD } from '../src/content/en/screening';
import { formatShort, toLocalDate } from '../src/domain/dates';
import { useApp, useLoad } from '../src/features/app';
import { currentCheck, markPart, modulesForCheck, skipCheck } from '../src/features/checkService';
import { saveSexualFlag } from '../src/features/checkService';
import { reconcileReminders } from '../src/features/reminderService';
import type { BundleKind } from '../src/domain/schedule';
import { Banner, Button, Card, Choice, H1, H2, Loading, P, Row, Screen } from '../src/ui/kit';

export default function CheckHub() {
  const { db, bump } = useApp();
  const today = toLocalDate(new Date());
  const { data } = useLoad(async (d) => {
    const c = await currentCheck(d, today);
    return { check: c, modules: c ? await modulesForCheck(d, c.row.kind as BundleKind) : [] };
  });
  const [sexual, setSexual] = useState<'yes' | 'no' | 'prefer_not' | undefined>();
  const [allDone, setAllDone] = useState(false);
  if (!data) return <Loading />;
  const c = data.check;
  if (allDone || !c) {
    return (
      <Screen title={BUNDLE.monthlyTitle} footer={<Button label={COMMON.done} onPress={() => router.back()} />}>
        <H1>{BUNDLE.allDone}</H1>
        <Card tone="soft" onPress={() => router.replace('/data')}>
          <P>{BUNDLE.exportOffer}</P>
        </Card>
        <P muted>{DATA.updateNote}</P>
      </Screen>
    );
  }
  const quarterly = c.row.kind === 'quarterly_review';
  const title = quarterly ? BUNDLE.quarterlyTitle : BUNDLE.monthlyTitle;
  const q = `checkId=${c.row.id}&parts=${c.parts.join(',')}`;
  const done = (p: string) => c.row.parts_done.includes(p);
  const finishPart = async (p: 'sexual_flag') => {
    const complete = await markPart(db, c.row.id, p, c.parts);
    reconcileReminders(db);
    bump();
    if (complete) setAllDone(true);
  };
  return (
    <Screen title={title}>
      <H1>{title}</H1>
      {!c.open ? <Banner tone="soft" text={`${BUNDLE.notYet} Due ${formatShort(c.row.due_on)}.`} /> : null}
      <P muted>{BUNDLE.expected(quarterly ? 10 : 8)}</P>
      {quarterly ? <P muted>{REVIEW_12W_CARD}</P> : null}
      {!data.modules.some((m) => m.validated) ? <P small muted>{BUNDLE.noValidated}</P> : null}
      {c.parts.map((p) => (
        <Card key={p}>
          <Row>
            <H2>{BUNDLE.parts[p]}</H2>
            {done(p) ? <P muted>{BUNDLE.partDone}</P> : null}
          </Row>
          {p === 'sexual_flag' && !done(p) && c.open ? (
            <>
              <P>{EVENTS.sexualActivityFlag}</P>
              <Choice options={EVENTS.sexualActivityOptions.map((o) => ({ value: o.value, label: o.label }))} value={sexual} onChange={setSexual} />
              <Button
                label={COMMON.save}
                disabled={!sexual}
                onPress={async () => {
                  await saveSexualFlag(db, sexual as 'yes' | 'no' | 'prefer_not', today);
                  await finishPart('sexual_flag');
                }}
              />
            </>
          ) : null}
          {p !== 'sexual_flag' && !done(p) && c.open ? (
            <Button
              label={BUNDLE.startPart}
              kind="secondary"
              onPress={() =>
                router.push(
                  p === 'safety' ? `/screening?kind=periodic&${q}` : p === 'questionnaires' ? `/questionnaire?${q}` : `/selfcheck?kind=monthly&${q}`
                )
              }
            />
          ) : null}
        </Card>
      ))}
      {c.open ? (
        <Button
          label="Skip this check"
          kind="quiet"
          onPress={async () => {
            await skipCheck(db, c.row.id);
            reconcileReminders(db);
            bump();
            router.back();
          }}
        />
      ) : null}
    </Screen>
  );
}
