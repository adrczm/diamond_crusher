// Optional event log (06a §4): leaks, sexual activity and notes about a day. Every item is skippable.
// Phone: the form, Save in the bottom bar, recent entries under it. Mac at c3+: recent entries on the left (5 of 12),
// the form on the right (7 of 12) with Save at its end and ⌘↵ (02-desktop-patterns 5). The form is LogForm.
// Q3: selecting an entry opens it in the form (on the Mac at c3 and c4, the right column) to change or delete it.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Alert } from '../src/platform/dialog';
import { EVENTS } from '../src/content/en/items';
import { COMMON } from '../src/content/en/strings';
import { deleteContextFlag, deleteEvent, listContextFlags, listEvents, type ContextFlagRow, type EventRow } from '../src/data/repositories/events';
import { formatTime } from '../src/domain/dates';
import { useApp, useLoad } from '../src/features/app';
import { leaveFlow } from '../src/features/screens/GuidedFlow';
import { useLogForm, type LogEntry } from '../src/features/screens/LogForm';
import { dayWord } from '../src/features/screens/WhenPicker';
import { Icon } from '../src/ui/icons';
import { Banner, Button, Card, Columns, Divider, Label, Loading, P, Row, Screen, useContentClass, useTouch, type PressState } from '../src/ui/kit';
import { Text } from '../src/ui/text';
import { radius, space, type, useColors } from '../src/ui/theme';
import { useDesktop } from '../src/ui/layout';

/** A row of the list. `open` is null for notes the monthly check made ("no sexual activity"): those can only be deleted. */
type Entry = { key: string; day: string; sort: string; text: string; remove: () => Promise<void>; open: LogEntry | null };

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
function RecentEntries({
  events,
  flags,
  selected,
  onOpen,
}: {
  events: EventRow[];
  flags: ContextFlagRow[];
  selected: string | null;
  onOpen: (e: LogEntry) => void;
}) {
  const { db, bump } = useApp();
  const [shown, setShown] = useState(12);
  const now = new Date();
  const entries: Entry[] = [
    ...events.map((e) => ({
      key: `event:${e.id}`,
      day: e.local_date,
      sort: `${e.local_date} ${e.occurred_at}`,
      text: eventText(e),
      remove: () => deleteEvent(db, e.id),
      open: { type: 'event', row: e } as LogEntry,
    })),
    ...flags.map((f) => ({
      key: `flag:${f.id}`,
      day: f.from_date,
      sort: `${f.from_date} 9`,
      text: EVENTS.flagText(f.kind, f.note),
      remove: () => deleteContextFlag(db, f.id),
      open: f.kind === 'no_sexual_activity_period' ? null : ({ type: 'flag', row: f } as LogEntry),
    })),
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
      <P small muted>
        {EVENTS.editHint}
      </P>
      {days.map((d, i) => (
        <View key={d} style={{ gap: 4 }}>
          {i > 0 ? <Divider /> : null}
          <P small muted>
            {dayWord(d, now)}
          </P>
          {list
            .filter((e) => e.day === d)
            .map((e) =>
              e.open ? (
                <EntryRow key={e.key} text={e.text} label={EVENTS.editEntry(`${dayWord(d, now)}, ${e.text}`)} selected={selected === e.key} onPress={() => onOpen(e.open as LogEntry)} />
              ) : (
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
              )
            )}
        </View>
      ))}
      {entries.length > shown ? <Button label={EVENTS.showOlder} kind="quiet" onPress={() => setShown(shown + 20)} /> : null}
    </Card>
  );
}

/** One entry that opens in the form. The open one is marked, so the list shows which entry the form holds. */
function EntryRow({ text, label, selected, onPress }: { text: string; label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  const touch = useTouch();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={(st) => ({
        minHeight: touch,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(1),
        marginHorizontal: -space(1),
        paddingHorizontal: space(1),
        borderRadius: radius.md,
        backgroundColor: selected ? c.selected : (st as PressState).hovered ? c.hover : 'transparent',
        opacity: st.pressed ? 0.7 : 1,
      })}
    >
      <Text style={[type('body-md'), { flex: 1, color: c.text }]}>{text}</Text>
      <Icon name="chevron" size={18} color={c.muted} />
    </Pressable>
  );
}

/** Inside Screen, so it can read the page's measured width (c1 to c4). */
function LogPage({
  form,
  events,
  flags,
  editing,
  onOpen,
}: {
  form: ReturnType<typeof useLogForm>;
  events: EventRow[];
  flags: ContextFlagRow[];
  editing: LogEntry | null;
  onOpen: (e: LogEntry) => void;
}) {
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
  const recent = <RecentEntries events={events} flags={flags} selected={editing ? `${editing.type}:${editing.row.id}` : null} onOpen={onOpen} />;
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
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const form = useLogForm({ editing, onDone: () => setEditing(null) });
  if (!data || !form.ready) return <Loading error={loadError} onRetry={reload} />;
  return (
    <Screen
      title={EVENTS.title}
      width={desktop ? 'wide' : 'regular'}
      // Phones: the opened entry fills the form at the top of the page, so go there.
      scrollTopKey={editing ? `${editing.type}:${editing.row.id}` : null}
      // No sticky bottom bar on the Mac (02-desktop-patterns 1.1). The phone keeps it.
      footer={desktop ? undefined : form.footer ?? <Button label={COMMON.done} kind="secondary" onPress={leaveFlow} />}
    >
      <LogPage form={form} events={data.events} flags={data.flags} editing={editing} onOpen={setEditing} />
    </Screen>
  );
}
