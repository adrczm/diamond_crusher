import { randomBytes } from 'crypto';
import { BackupError, decryptBackup, encryptBackup, passphraseOk, readHeader } from '../../src/data/backup/container';
import { buildPayload, importMerge, importReplace, preview, tableCounts, validatePayload } from '../../src/data/backup/exportImport';
import { insertEvent } from '../../src/data/repositories/events';
import { updateProfile } from '../../src/data/repositories/profile';
import { insertSession } from '../../src/data/repositories/sessions';
import { strengthPlan, DEFAULT_LOAD } from '../../src/domain/session/plan';
import { freshDb } from '../helpers/db';

const rand = (n: number) => new Uint8Array(randomBytes(n));
const ITER = 1000; // tests use a low count; the app uses 600,000

async function seeded() {
  const db = await freshDb();
  await updateProfile(db, { nickname: 'Testname', anatomy: 'male' });
  const plan = strengthPlan(DEFAULT_LOAD, false, 'lying');
  await insertSession(
    db,
    {
      started_at: '2026-01-05T08:00:00.000Z',
      ended_at: '2026-01-05T08:03:00.000Z',
      local_date: '2026-01-05',
      tz_offset_min: 0,
      slot_no: 1,
      mode: 'standard',
      position: 'lying',
      template_key: 'strength',
      template_version: 1,
      planned: plan,
      completion: 'complete',
      active_duration_s: 170,
      counts_toward_day: true,
      from_reminder_id: null,
    },
    [{ seq: 1, block: 'hold', plannedReps: 8, plannedHoldS: 3, plannedRestS: 5, completedReps: 8, endReason: 'completed' }]
  );
  await insertEvent(db, {
    type: 'leak',
    occurred_at: '2026-01-06T10:00:00.000Z',
    local_date: '2026-01-06',
    tz_offset_min: 0,
    entered_at: '2026-01-06T10:00:00.000Z',
    leak_situation: 'cough_sneeze',
    leak_amount: 'drops',
    activity_type: null,
    hardness: null,
    ejac_time_band: null,
    ejac_time_min: null,
    control_0_10: null,
    bother_0_10: null,
    item_set_version: 1,
  });
  return db;
}

const info = { appVersion: '1.0.0', installId: '00000000-0000-4000-8000-000000000000', lockEnabled: false, lockTimeoutS: 60, now: new Date('2026-02-01T00:00:00Z') };

describe('backup file (PRIV-030 to PRIV-037)', () => {
  it('round-trips export → fresh install → import Replace with equal tables (A-PRIV-6)', async () => {
    const a = await seeded();
    const file = await encryptBackup(await buildPayload(a, info), 'correct horse battery staple', rand, { iterations: ITER });
    const b = await freshDb();
    const payload = validatePayload(await decryptBackup(file, 'correct horse battery staple'));
    expect(preview(payload)).toMatchObject({ sessions: 1, events: 1, from: '2026-01-05', to: '2026-01-06' });
    await importReplace(b, payload);
    expect(await tableCounts(b)).toEqual(await tableCounts(a));
    const profile = await b.get<{ nickname: string }>('SELECT nickname FROM profile');
    expect(profile?.nickname).toBe('Testname');
  });

  it('rejects a wrong passphrase without touching data (A-PRIV-7)', async () => {
    const a = await seeded();
    const file = await encryptBackup(await buildPayload(a, info), 'correct horse battery staple', rand, { iterations: ITER });
    await expect(decryptBackup(file, 'wrong passphrase here')).rejects.toMatchObject({ code: 'wrong_passphrase_or_damaged' });
  });

  it('rejects a flipped byte in the header or ciphertext (A-PRIV-8)', async () => {
    const a = await seeded();
    const file = await encryptBackup(await buildPayload(a, info), 'correct horse battery staple', rand, { iterations: ITER });
    const h = file.slice();
    h[12] ^= 1;
    await expect(decryptBackup(h, 'correct horse battery staple')).rejects.toBeInstanceOf(BackupError);
    const c = file.slice();
    c[c.length - 20] ^= 1;
    await expect(decryptBackup(c, 'correct horse battery staple')).rejects.toMatchObject({ code: 'wrong_passphrase_or_damaged' });
  });

  it('shows only the magic and header in clear text (A-PRIV-9)', async () => {
    const a = await seeded();
    const file = await encryptBackup(await buildPayload(a, info), 'correct horse battery staple', rand, { iterations: ITER });
    const text = Buffer.from(file).toString('latin1');
    expect(text.startsWith('DCBK')).toBe(true);
    expect(text).not.toContain('Testname');
    expect(text).not.toContain('2026-01-05');
    const { header } = readHeader(file);
    expect(Object.keys(header).sort()).toEqual(['cipher', 'compression', 'kdf', 'kdf_params', 'nonce', 'salt']);
  });

  it('merging the same export twice adds no duplicates (A-PRIV-10)', async () => {
    const a = await seeded();
    const payload = await buildPayload(a, info);
    const b = await freshDb();
    await importMerge(b, payload, 'backup');
    const once = await tableCounts(b);
    await importMerge(b, payload, 'backup');
    expect(await tableCounts(b)).toEqual(once);
    expect(once.session).toBe(1);
  });

  it('rejects files that are not backups', async () => {
    await expect(decryptBackup(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 'x')).rejects.toMatchObject({ code: 'not_a_backup' });
  });

  it('requires 12+ characters or 4 words (PRIV-031)', () => {
    expect(passphraseOk('short')).toBe(false);
    expect(passphraseOk('twelve chars')).toBe(true);
    expect(passphraseOk('a b c d')).toBe(true);
  });
});
