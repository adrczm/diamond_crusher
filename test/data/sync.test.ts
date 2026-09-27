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
import { getSettings, updateSettings } from '../../src/data/repositories/settings';
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
    await updateSettings(b, { theme: 'dark', weekly_days_target: 6 });
    await updateProgramme(a, { hold_s: 6, hold_reps: 9 });
    await sync(a, b);
    for (const db of [a, b]) {
      const s = await getSettings(db);
      const p = await getProgramme(db);
      expect(s.theme).toBe('dark');
      expect(s.weekly_days_target).toBe(6);
      expect(p.hold_s).toBe(6);
      expect(p.hold_reps).toBe(9);
    }
  });

  it('never syncs device-only settings (SYNC-015)', async () => {
    const [a, b] = [await freshDb(), await freshDb()];
    await pair(a, b);
    await updateSettings(a, { notification_permission: 'granted', lock_enabled: true, theme: 'light' });
    await sync(a, b);
    const s = await getSettings(b);
    expect(s.theme).toBe('light');
    expect(s.notification_permission).toBe('undetermined');
    expect(s.lock_enabled).toBe(false);
  });

  it('lets the later edit win even when the other clock runs ahead (A-SYNC-5)', async () => {
    const [a, b] = [await freshDb(), await freshDb()];
    await pair(a, b);
    // Device b's clock is two hours fast.
    await b.run('UPDATE sync_clock SET wall = wall + 7200000');
    await updateSettings(b, { audio_mode: 'voice' });
    await sync(b, a);
    // a has now seen b's clock, so its next edit is ordered after it.
    await updateSettings(a, { audio_mode: 'off' });
    await sync(a, b);
    expect((await getSettings(b)).audio_mode).toBe('off');
    expect((await getSettings(a)).audio_mode).toBe('off');
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
