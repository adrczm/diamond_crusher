// Optional event log (06a §4): leaks, sexual activity and notes about a day. Every item is skippable.
// Phone: the form, Save in the bottom bar, recent entries under it. Mac at c3+: recent entries on the left (5 of 12),
// the form on the right (7 of 12) with Save at its end and ⌘↵ (02-desktop-patterns 5). The form is LogForm.
import { useState } from 'react';
import { View } from 'react-native';
import { Alert } from '../src/platform/dialog';
import { EVENTS } from '../src/content/en/items';
import { COMMON } from '../src/content/en/strings';
import { deleteContextFlag, deleteEvent, listContextFlags, listEvents, type ContextFlagRow, type EventRow } from '../src/data/repositories/events';
import { formatTime } from '../src/domain/dates';
import { useApp, useLoad } from '../src/features/app';
import { leaveFlow } from '../src/features/screens/GuidedFlow';
import { useLogForm } from '../src/features/screens/LogForm';
import { dayWord } from '../src/features/screens/WhenPicker';
import { Banner, Button, Card, Columns, Divider, Label, Loading, P, Row, Screen, useContentClass } from '../src/ui/kit';
import { useDesktop } from '../src/ui/layout';

type Entry = { key: string; day: string; sort: string; text: string; remove: () => Promise<void> };

/** A row names the part of the day (or the exact time) and the details, so two leaks on one day can be told apart (DS-E9). */
function eventText(e: EventRow): string {
  // Round 2: the part of the day that was picked, never a made-up clock time. Old entries and "now" show the time.
  const when = e.occurred_period ? EVENTS.periods[e.occurred_period] : e.occurred_at ? formatTime(new Date(e.occurred_at)) : '';
  const detail =
    e.type === 'leak'
      ? [EVENTS.situations.find((x) => x.value === e.leak_situation)?.label, EVENTS.amounts.find((x) => x.value === e.leak_amount)?.label].filter(Boolean).join(', ')
      : EVENTS.activities.find((x) => x.value === e.activity_type)?.label ?? '';
  return `${when ? `${when} · ` : ''}${e.type === 'leak' ? EVENTS.leakType : EVENTS.sexType}${detail ? `: ${detail}` : ''}`;
}

/** Recent entries, grouped by day, newest first. Notes about a day sit in their day. */
function RecentEntries({ events, flags }: { events: EventRow[]; flags: ContextFlagRow[] }) {
  const { db, bump } = useApp();
  const [shown, setShown] = useState(12);
  const now = new Date();
  const entries: Entry[] = [
    ...events.map((e) => ({ key: `e:${e.id}`, day: e.local_date, sort: `${e.local_date} ${e.occurred_at}`, text: eventText(e), remove: () => deleteEvent(db, e.id) })),
    ...flags.map((f) => ({ key: `f:${f.id}`, day: f.from_date, sort: `${f.from_date} 9`, text: EVENTS.flagText(f.kind, f.note), remove: () => deleteContextFlag(db, f.id) })),
  ].sort((a, b) => (a.sort < b.sort ? 1 : -1));
  if (!entries.length) return null;
  const list = entries.slice(0, shown);
  const days = [...new Set(list.map((e) => e.day))];
  const confirmDelete = (fn: () => Promise<void>) =>
    Alert.alert(COMMON.delete, EVENTS.deleteAsk, [
      { text: COMMON.cancel, style: 'cancel' },
      { text: COMMON.delete, style: 'destructive', onPress: () => void fn().then(bump) },
    ]);
  return (
    <Card>
      <Label>{EVENTS.recent}</Label>
      {days.map((d, i) => (
        <View key={d} style={{ gap: 4 }}>
          {i > 0 ? <Divider /> : null}
          <P small muted>
            {dayWord(d, now)}
          </P>
          {list
            .filter((e) => e.day === d)
            .map((e) => (
              <Row key={e.key}>
                <View style={{ flex: 1, minWidth: 160 }}>
                  <P>{e.text}</P>
                </View>
                <Button
                  label={COMMON.delete}
                  kind="quiet"
                  accessibilityLabel={EVENTS.deleteEntry(`${dayWord(d, now)}, ${e.text}`)}
                  onPress={() => confirmDelete(e.remove)}
                />
              </Row>
            ))}
        </View>
      ))}
      {entries.length > shown ? <Button label={EVENTS.showOlder} kind="quiet" onPress={() => setShown(shown + 20)} /> : null}
    </Card>
  );
}

/** Inside Screen, so it can read the page's measured width (c1 to c4). */
function LogPage({ form, events, flags }: { form: ReturnType<typeof useLogForm>; events: EventRow[]; flags: ContextFlagRow[] }) {
  const desktop = useDesktop();
  const cls = useContentClass();
  const saved = form.saved ? <Banner tone="success" text={EVENTS.saved} /> : null;
  // The Mac: Save at the end of the form. The phone: Save in the bottom bar.
  const formCol = (
    <View style={{ gap: desktop ? 20 : 16 }}>
      {saved}
      {form.body}
      {desktop ? form.inlineActions : null}
    </View>
  );
  const recent = <RecentEntries events={events} flags={flags} />;
  if (desktop && (cls === 'c3' || cls === 'c4')) return <Columns ratio={[5, 7]}>{[recent, formCol]}</Columns>;
  // Phone and narrow windows: the form first; the list under it, out of the way while a type is picked on the phone.
  return (
    <>
      {formCol}
      {desktop || !form.kind ? recent : null}
    </>
  );
}

export default function LogScreen() {
  const desktop = useDesktop();
  const { data, reload, error: loadError } = useLoad(async (d) => ({ events: await listEvents(d), flags: await listContextFlags(d) }));
  const form = useLogForm();
  if (!data || !form.ready) return <Loading error={loadError} onRetry={reload} />;
  return (
    <Screen
      title={EVENTS.title}
      width={desktop ? 'wide' : 'regular'}
      // No sticky bottom bar on the Mac (02-desktop-patterns 1.1). The phone keeps it.
      footer={desktop ? undefined : form.footer ?? <Button label={COMMON.done} kind="secondary" onPress={leaveFlow} />}
    >
      <LogPage form={form} events={data.events} flags={data.flags} />
    </Screen>
  );
}
