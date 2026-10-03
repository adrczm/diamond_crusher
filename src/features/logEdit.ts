// Changing a logged entry from the list (Q3): the form's answers from a stored row, and the change to save back.
// The row is updated in place, so it keeps its id; `update` sets updated_at and the sync trigger a new hlc.
import { EVENTS } from '../content/en/items';
import type { ContextFlagRow, EjacBand, EventRow, LeakSituation, updateContextFlag, updateEvent } from '../data/repositories/events';
import { addDays, diffDays, tzOffsetMin, type LocalDate } from '../domain/dates';
import { periodOf, savedTime, type When } from '../domain/when';

export type LogKind = 'leak' | 'sex' | 'context';

/** A stored entry opened from the list to change or delete (Q3). */
export type LogEntry = { type: 'event'; row: EventRow } | { type: 'flag'; row: ContextFlagRow };

/** What the form holds. */
export interface LogValues {
  kind: LogKind | undefined;
  day: LocalDate;
  when: When;
  situation: LeakSituation | undefined;
  amount: 'drops' | 'more' | undefined;
  activity: 'penetrative_vaginal' | 'other_partnered' | 'solo' | undefined;
  firm: number | null | undefined;
  band: EjacBand | undefined;
  control: number | undefined;
  bother: number | undefined;
  note: string;
}

/** The form filled in from a stored entry. An entry saved at an exact time shows the part of the day it falls in. */
export function valuesOf(e: LogEntry): LogValues {
  const blank = { situation: undefined, amount: undefined, activity: undefined, firm: undefined, band: undefined, control: undefined, bother: undefined };
  if (e.type === 'flag') return { ...blank, kind: 'context', day: e.row.from_date, when: 'now', note: e.row.note ?? '' };
  const r = e.row;
  const sex = r.type === 'sexual_activity';
  return {
    kind: sex ? 'sex' : 'leak',
    day: r.local_date,
    when: r.occurred_period ?? periodOf(new Date(r.occurred_at)),
    situation: r.leak_situation ?? undefined,
    amount: r.leak_amount ?? undefined,
    activity: r.activity_type ?? undefined,
    // Firmness "Not sure" is stored as null, so a sexual activity entry without a firmness opens as unanswered.
    firm: r.hardness ?? undefined,
    band: r.ejac_time_band ?? undefined,
    control: r.control_0_10 ?? undefined,
    bother: r.bother_0_10 ?? undefined,
    note: '',
  };
}

/** Answers changed since the entry opened. The time slider is left out: the form moves it itself when the day changes. */
export function answersChanged(a: LogValues, b: LogValues): boolean {
  const { when: _a, ...x } = a;
  const { when: _b, ...y } = b;
  return JSON.stringify(x) !== JSON.stringify(y);
}

/**
 * The change to a stored event (Q3). The time stays as it was unless the day or the part of the day was changed
 * (`timeChanged`); a typed time to ejaculation is cleared only when another range is picked.
 */
export function eventPatch(row: EventRow, v: LogValues, timeChanged: boolean, now: Date): Parameters<typeof updateEvent>[2] {
  const time = timeChanged ? savedTime(v.day, v.when, now) : null;
  const when = time ? { occurred_at: time.at.toISOString(), local_date: time.localDate, tz_offset_min: tzOffsetMin(time.at), occurred_period: time.period } : {};
  if (row.type === 'leak') return { ...when, leak_situation: v.situation ?? null, leak_amount: v.amount ?? null };
  return {
    ...when,
    activity_type: v.activity ?? null,
    hardness: v.firm ?? null,
    ejac_time_band: v.band ?? null,
    ...(v.band !== (row.ejac_time_band ?? undefined) ? { ejac_time_min: null } : {}),
    control_0_10: v.control ?? null,
    bother_0_10: v.bother ?? null,
  };
}

/** The change to a stored day note: the text, and the day if it was moved (a note over several days moves as a whole). */
export function flagPatch(row: ContextFlagRow, v: LogValues): Parameters<typeof updateContextFlag>[2] {
  const moved = v.day !== row.from_date;
  return {
    note: v.note.trim() ? v.note.trim().slice(0, EVENTS.noteMax) : row.note,
    ...(moved ? { from_date: v.day, to_date: row.to_date ? addDays(row.to_date, diffDays(row.from_date, v.day)) : null } : {}),
  };
}
