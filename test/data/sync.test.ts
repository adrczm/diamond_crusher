import { randomBytes } from 'crypto';
import { applyChangeSet, buildChangeSet, changeCount, localNode, type ChangeSet } from '../../src/data/sync/changes';
import {
  checkCode,
  decodeConfirm,
  decodePairing,
  encodeConfirm,
  encodePairing,
  FrameCollector,
  openChanges,
  parseFrame,
  sealChanges,
  toFrames,
  CodeError,
} from '../../src/data/sync/codes';
import { getProgramme, updateProgramme } from '../../src/data/repositories/programme';
import { getSettings, todayHero, updateSettings } from '../../src/data/repositories/settings';
import { openNodeDb } from '../../src/data/nodeSql';
import { migrate } from '../../src/data/migrate';
import { ensureSingletons } from '../../src/data/init';
import { deleteSession, insertSession, listSessions } from '../../src/data/repositories/sessions';
import type { SqlDb } from '../../src/data/sql';
import { strengthPlan, DEFAULT_LOAD } from '../../src/domain/session/plan';
import { freshDb } from '../helpers/db';

const rand = (n: number) => new Uint8Array(randomBytes(n));

async function pair(a: SqlDb, b: SqlDb) {
  const key = Buffer.from(rand(32)).toString('hex');
  const [na, nb] = [await localNode(a), await localNode(b)];
  const now = new Date().toISOString();
  await a.run("INSERT INTO sync_peer (id, peer_node, peer_kind, sync_key, paired_at) VALUES (1, ?, 'computer', ?, ?)", [nb, key, now]);
  await b.run("INSERT INTO sync_peer (id, peer_node, peer_kind, sync_key, paired_at) VALUES (1, ?, 'phone', ?, ?)", [na, key, now]);
}

/** One full sync: a shows, b scans; then b shows, a scans. Goes through the real encryption and QR framing. */
async function sync(a: SqlDb, b: SqlDb) {
  await send(a, b);
  await send(b, a);
}

async function send(from: SqlDb, to: SqlDb): Promise<ChangeSet> {
  const cs = await buildChangeSet(from);
  const key = Buffer.from((await from.get<{ sync_key: string }>('SELECT sync_key FROM sync_peer'))!.sync_key, 'hex');
  const toNode = await localNode(to);
  const sealed = sealChanges(cs, key, toNode, rand(12));
  const frames = toFrames(sealed, 'ABCD');
  const c = new FrameCollector();
  for (const f of [...frames].reverse()) c.add(parseFrame(f));
  expect(c.complete).toBe(true);
  const opened = openChanges(c.bytes(), key, cs.from, toNode);
  await applyChangeSet(to, opened);
  return cs;
}

async function addSession(db: SqlDb, date: string) {
  return insertSession(
    db,
    {
      started_at: `${date}T08:00:00.000Z`,
      ended_at: `${date}T08:03:00.000Z`,
      local_date: date,
      tz_offset_min: 0,
      slot_no: 1,
      mode: 'standard',
      position: 'lying',
      template_key: 'strength',
      template_version: 1,
      planned: strengthPlan(DEFAULT_LOAD, false, 'lying'),
      completion: 'complete',
      active_duration_s: 170,
      counts_toward_day: true,
      from_reminder_id: null,
    },
    [{ seq: 1, block: 'hold', plannedReps: 8, plannedHoldS: 3, plannedRestS: 5, completedReps: 8, endReason: 'completed' }]
  );
}

const ids = async (db: SqlDb) => (await listSessions(db)).map((s) => s.id).sort();

describe('sync engine (07 §11)', () => {
  it('gives each install its own clock node', async () => {
    const [a, b] = [await freshDb(), await freshDb()];
    expect(await localNode(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(await localNode(a)).not.toBe(await localNode(b));
  });

  it('combines sessions made on both devices, and syncing again changes nothing (A-SYNC-2)', async () => {
    const [a, b] = [await freshDb(), await freshDb()];
    await pair(a, b);
    await addSession(a, '2026-09-20');
    await addSession(b, '2026-09-21');
    await sync(a, b);
    expect(await ids(a)).toEqual(await ids(b));
    expect((await ids(a)).length).toBe(2);
    await sync(a, b);
    await sync(b, a);
    expect((await ids(a)).length).toBe(2);
    expect((await b.all('SELECT * FROM exercise_set')).length).toBe(2);
    // Nothing left to send once both sides have confirmed.
    expect(changeCount(await buildChangeSet(a))).toBe(0);
    expect(changeCount(await buildChangeSet(b))).toBe(0);
  });

  it('keeps a deleted session deleted in both directions (A-SYNC-3)', async () => {
    const [a, b] = [await freshDb(), await freshDb()];
    await pair(a, b);
    const id = await addSession(a, '2026-09-20');
    await sync(a, b);
    await deleteSession(b, id);
    await sync(b, a);
    expect(await ids(a)).toEqual([]);
    await sync(a, b);
    await sync(b, a);
    expect(await ids(a)).toEqual([]);
    expect(await ids(b)).toEqual([]);
    expect((await a.all('SELECT * FROM exercise_set')).length).toBe(0);
  });

  it('keeps a setting changed on one device and a level-up on the other (A-SYNC-4)', async () => {
    const [a, b] = [await freshDb(), await freshDb()];
    await pair(a, b);
    await sync(a, b);
    await updateSettings(b, { week_start_day: 7, weekly_days_target: 6 });
    await updateProgramme(a, { hold_s: 6, hold_reps: 9 });
    await sync(a, b);
    for (const db of [a, b]) {
      const s = await getSettings(db);
      const p = await getProgramme(db);
      expect(s.week_start_day).toBe(7);
      expect(s.weekly_days_target).toBe(6);
      expect(p.hold_s).toBe(6);
      expect(p.hold_reps).toBe(9);
    }
  });

  it('never syncs device-only settings (SYNC-015)', async () => {
    const [a, b] = [await freshDb(), await freshDb()];
    await pair(a, b);
    await updateSettings(a, { notification_permission: 'granted', lock_enabled: true, theme: 'light', audio_mode: 'off', vibration: false, week_start_day: 7 });
    await sync(a, b);
    const s = await getSettings(b);
    expect(s.week_start_day).toBe(7);
    // Decision 3 (2026-09-29): theme, sound and vibration stay per device.
    expect(s.theme).toBe('system');
    expect(s.audio_mode).not.toBe('off');
    expect(s.vibration).toBe(true);
    expect(s.notification_permission).toBe('undetermined');
    expect(s.lock_enabled).toBe(false);
  });

  it('lets the later edit win even when the other clock runs ahead (A-SYNC-5)', async () => {
    const [a, b] = [await freshDb(), await freshDb()];
    await pair(a, b);
    // Device b's clock is two hours fast.
    await b.run('UPDATE sync_clock SET wall = wall + 7200000');
    await updateSettings(b, { weekly_days_target: 4 });
    await sync(b, a);
    // a has now seen b's clock, so its next edit is ordered after it.
    await updateSettings(a, { weekly_days_target: 6 });
    await sync(a, b);
    expect((await getSettings(b)).weekly_days_target).toBe(6);
    expect((await getSettings(a)).weekly_days_target).toBe(6);
  });

  it('replaces the other device’s reminder instead of adding a second one (natural key)', async () => {
    const [a, b] = [await freshDb(), await freshDb()];
    await pair(a, b);
    const mk = (db: SqlDb, id: string, time: string) =>
      db.run("INSERT INTO reminder (id, kind, slot_no, enabled, time_local, created_at) VALUES (?, 'monthly_check', NULL, 1, ?, ?)", [id, time, new Date().toISOString()]);
    await mk(a, 'ra', '09:00');
    await mk(b, 'rb', '08:15');
    await sync(a, b);
    const ra = await a.all<{ id: string; time_local: string }>("SELECT id, time_local FROM reminder WHERE kind = 'monthly_check'");
    const rb = await b.all<{ id: string; time_local: string }>("SELECT id, time_local FROM reminder WHERE kind = 'monthly_check'");
    expect(ra.length).toBe(1);
    expect(rb.length).toBe(1);
    expect(ra[0]).toEqual(rb[0]);
  });

  it('rejects changes sealed for another pairing (A-SYNC-6)', async () => {
    const [a, b] = [await freshDb(), await freshDb()];
    await pair(a, b);
    await addSession(a, '2026-09-20');
    const cs = await buildChangeSet(a);
    const sealed = sealChanges(cs, rand(32), await localNode(b), rand(12));
    const key = Buffer.from((await b.get<{ sync_key: string }>('SELECT sync_key FROM sync_peer'))!.sync_key, 'hex');
    expect(() => openChanges(sealed, key, cs.from, 'ffffffff')).toThrow(CodeError);
    expect(await ids(b)).toEqual([]);
  });

  it('carries a heavy year in frames that can arrive in any order, with repeats', async () => {
    const [a, b] = [await freshDb(), await freshDb()];
    await pair(a, b);
    for (let d = 1; d <= 60; d++) await addSession(a, `2026-0${d <= 30 ? 7 : 8}-${String(((d - 1) % 30) + 1).padStart(2, '0')}`);
    const cs = await buildChangeSet(a);
    const key = rand(32);
    const frames = toFrames(sealChanges(cs, key, 'aabbccdd', rand(12)), 'WXYZ');
    expect(frames.length).toBeGreaterThan(1);
    for (const f of frames) expect(f).toMatch(/^[A-Z0-9/]+$/);
    const c = new FrameCollector();
    for (const f of [...frames, ...frames].sort(() => Math.random() - 0.5)) c.add(parseFrame(f));
    expect(openChanges(c.bytes(), key, cs.from, 'aabbccdd').rows.session?.length).toBe(60);
  });
});

describe('pairing codes (SYNC-020, SYNC-021)', () => {
  it('confirms the pair and shows the same check number on both sides', () => {
    const offer = { key: rand(32), nonce: rand(16), node: 'a1b2c3d4', kind: 'computer' as const };
    const text = encodePairing(offer);
    expect(text).toMatch(/^[A-Z0-9/]+$/);
    const got = decodePairing(text);
    expect(got.node).toBe('a1b2c3d4');
    const reply = encodeConfirm(got, '0f0f0f0f', 'phone');
    expect(decodeConfirm(reply, offer)).toEqual({ node: '0f0f0f0f', kind: 'phone' });
    expect(checkCode(got.key, got.nonce)).toBe(checkCode(offer.key, offer.nonce));
    expect(checkCode(offer.key, offer.nonce)).toMatch(/^\d{6}$/);
  });

  it('refuses a reply made for a different pairing code', () => {
    const offer = { key: rand(32), nonce: rand(16), node: 'a1b2c3d4', kind: 'computer' as const };
    const other = { ...offer, key: rand(32) };
    expect(() => decodeConfirm(encodeConfirm(other, '0f0f0f0f', 'phone'), offer)).toThrow(CodeError);
    expect(() => decodePairing('https://example.com')).toThrow(CodeError);
  });
});

describe('schema 3 (design round 2)', () => {
  it('upgrades a schema 2 database and keeps its rows and sync clocks', async () => {
    const db = openNodeDb();
    await migrate(db, 'test', 2);
    await ensureSingletons(db, true);
    await db.run("INSERT INTO context_flag (id, kind, from_date, note, created_at) VALUES ('c1', 'illness', '2026-10-01', 'cold', 'x')");
    await db.run("INSERT INTO training_slot (id, slot_no, active, created_at) VALUES ('t1', 2, 1, 'x')");
    await updateSettings(db, { weekly_days_target: 4 });
    expect(await migrate(db, 'test', 3)).toEqual({ status: 'ok', from: 2, to: 3 });
    expect((await getSettings(db)).weekly_days_target).toBe(4);
    expect(await db.get("SELECT note FROM context_flag WHERE id = 'c1'")).toEqual({ note: 'cold' });
    // The rebuilt tables accept the new ranges and still stamp clocks and tombstones.
    await updateSettings(db, { sessions_per_day_target: 5, timer_view: 'wave' });
    await db.run("INSERT INTO training_slot (id, slot_no, active, created_at) VALUES ('t5', 5, 1, 'x')");
    await db.run(`UPDATE context_flag SET note = '${'a'.repeat(280)}' WHERE id = 'c1'`);
    expect((await db.get<{ hlc: string }>("SELECT hlc FROM training_slot WHERE id = 't5'"))!.hlc).not.toBe('');
    await db.run("DELETE FROM training_slot WHERE id = 't1'");
    expect(await db.get("SELECT pk FROM sync_tombstone WHERE table_name = 'training_slot'")).toEqual({ pk: '["t1"]' });
    await expect(db.run("UPDATE settings SET sessions_per_day_target = 0 WHERE id = 1")).rejects.toThrow();
    await expect(db.run(`UPDATE context_flag SET note = '${'a'.repeat(281)}' WHERE id = 'c1'`)).rejects.toThrow();
    const fields = (await db.all<{ field: string }>("SELECT field FROM sync_field WHERE table_name = 'settings'")).map((r) => r.field);
    expect(fields).toEqual(expect.arrayContaining(['timer_view', 'today_hero_shared', 'today_hero_sync', 'sessions_per_day_target']));
    expect(fields).not.toContain('today_hero');
  });

  it('syncs the timer view and a shared Today card, but not the device-only Today card', async () => {
    const a = await freshDb();
    const b = await freshDb();
    await pair(a, b);
    await updateSettings(a, { timer_view: 'wave', today_hero: 'rings', sessions_per_day_target: 4 });
    await sync(a, b);
    const s = await getSettings(b);
    expect(s.timer_view).toBe('wave');
    expect(s.today_hero).toBeNull();
    expect(s.sessions_per_day_target).toBe(4);
    await updateSettings(a, { today_hero_sync: true, today_hero_shared: 'rings' });
    await sync(a, b);
    expect(todayHero(await getSettings(b))).toBe('rings');
  });

  it('syncs the part of the day of a logged event', async () => {
    const a = await freshDb();
    const b = await freshDb();
    await pair(a, b);
    await a.run(
      "INSERT INTO event (id, type, occurred_at, local_date, tz_offset_min, entered_at, leak_situation, leak_amount, item_set_version, created_at, occurred_period) VALUES ('e1', 'leak', '2026-10-02T19:00:00.000Z', '2026-10-02', 0, 'x', 'urge', 'drops', 1, 'x', 'evening')"
    );
    await sync(a, b);
    await a.run("UPDATE event SET occurred_period = 'night' WHERE id = 'e1'");
    await sync(a, b);
    expect(await b.get("SELECT occurred_period FROM event WHERE id = 'e1'")).toEqual({ occurred_period: 'night' });
  });
});

describe('schema 4 (profiles and research changes)', () => {
  it('upgrades a schema 3 database, keeps goals and accepts the new goals and columns', async () => {
    const db = openNodeDb();
    await migrate(db, 'test', 3);
    await ensureSingletons(db, true);
    await db.run("INSERT INTO profile_goal (goal, added_at, active, created_at) VALUES ('erection', 'x', 1, 'x')");
    expect(await migrate(db, 'test')).toEqual({ status: 'ok', from: 3, to: 4 });
    expect(await db.get("SELECT goal FROM profile_goal")).toEqual({ goal: 'erection' });
    await db.run("INSERT INTO profile_goal (goal, added_at, active, created_at) VALUES ('bowel_control', 'x', 1, 'x')");
    await db.run("INSERT INTO profile_goal (goal, added_at, active, created_at) VALUES ('pregnancy_birth', 'x', 1, 'x')");
    await expect(db.run("INSERT INTO profile_goal (goal, added_at, active, created_at) VALUES ('prolapse', 'x', 1, 'x')")).rejects.toThrow();
    expect((await db.get<{ hlc: string }>("SELECT hlc FROM profile_goal WHERE goal = 'bowel_control'"))!.hlc).not.toBe('');
    await db.run('UPDATE programme_state SET gentle_unlocked_at = ?, gentle_pain_lock = 1 WHERE id = 1', ['2026-10-03T10:00:00.000Z']);
    await expect(db.run('UPDATE programme_state SET gentle_pain_lock = 2 WHERE id = 1')).rejects.toThrow();
    const fields = (await db.all<{ field: string }>("SELECT field FROM sync_field WHERE table_name = 'programme_state'")).map((r) => r.field);
    expect(fields).toEqual(expect.arrayContaining(['gentle_unlocked_at', 'gentle_pain_lock']));
  });

  it('syncs the gentle squeeze unlock and a leak at orgasm', async () => {
    const a = await freshDb();
    const b = await freshDb();
    await pair(a, b);
    await a.run("UPDATE programme_state SET gentle_unlocked_at = '2026-10-03T10:00:00.000Z' WHERE id = 1");
    await a.run(
      "INSERT INTO event (id, type, occurred_at, local_date, tz_offset_min, entered_at, activity_type, item_set_version, created_at, orgasm_leak) VALUES ('e2', 'sexual_activity', '2026-10-02T19:00:00.000Z', '2026-10-02', 0, 'x', 'solo', 1, 'x', 'yes')"
    );
    await sync(a, b);
    expect(await b.get('SELECT gentle_unlocked_at FROM programme_state WHERE id = 1')).toEqual({ gentle_unlocked_at: '2026-10-03T10:00:00.000Z' });
    expect(await b.get("SELECT orgasm_leak FROM event WHERE id = 'e2'")).toEqual({ orgasm_leak: 'yes' });
  });
});
