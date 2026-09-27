// The web version's database (Safari on a Mac): sql.js in memory, saved encrypted after every write.
import initSqlJs from 'sql.js';
import { migrate } from '../../src/data/migrate';
import { ensureSingletons } from '../../src/data/init';
import { openWebDb, WrongKeyError, type BlobStore, type SqlJsStatic } from '../../src/data/webSql';
import { getSettings, updateSettings } from '../../src/data/repositories/settings';
import { applyChangeSet, buildChangeSet, localNode } from '../../src/data/sync/changes';
import { freshDb } from '../helpers/db';

const KEY = 'ab'.repeat(32);
const OTHER = 'cd'.repeat(32);

function memoryStore() {
  const m = new Map<string, { iv: Uint8Array; data: Uint8Array }>();
  const store: BlobStore = {
    get: async (n) => m.get(n),
    set: async (n, v) => void m.set(n, v),
    remove: async (n) => void m.delete(n),
  };
  return { m, store };
}

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = (await initSqlJs()) as unknown as SqlJsStatic;
});

test('writes survive closing and reopening, and migrations run', async () => {
  const { store } = memoryStore();
  const db = await openWebDb(SQL, store, KEY, 'dc.db');
  expect((await migrate(db, '1.0.0')).status).not.toBe('newer');
  await ensureSingletons(db, true);
  await db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
  await db.run('INSERT INTO t (v) VALUES (?)', ['one']);
  await db.transaction(async () => {
    await db.run('INSERT INTO t (v) VALUES (?)', ['two']);
  });
  await db.close();

  const again = await openWebDb(SQL, store, KEY, 'dc.db');
  expect(await again.all<{ v: string }>('SELECT v FROM t ORDER BY id')).toEqual([{ v: 'one' }, { v: 'two' }]);
  expect(await again.get('SELECT id FROM meta WHERE id = 1')).toEqual({ id: 1 });
});

test('a failed transaction rolls back and saves nothing', async () => {
  const { store } = memoryStore();
  const db = await openWebDb(SQL, store, KEY, 'dc.db');
  await db.exec('CREATE TABLE t (v TEXT)');
  await expect(
    db.transaction(async () => {
      await db.run('INSERT INTO t (v) VALUES (?)', ['x']);
      throw new Error('boom');
    }),
  ).rejects.toThrow('boom');
  const again = await openWebDb(SQL, store, KEY, 'dc.db');
  expect(await again.all('SELECT * FROM t')).toEqual([]);
});

test('the saved copy is encrypted and needs the right key', async () => {
  const { m, store } = memoryStore();
  const db = await openWebDb(SQL, store, KEY, 'dc.db');
  await db.exec("CREATE TABLE secret (v TEXT); INSERT INTO secret VALUES ('pelvic floor diary')");
  const saved = m.get('dc.db')!;
  expect(Buffer.from(saved.data).includes('pelvic floor diary')).toBe(false);
  expect(Buffer.from(saved.data).includes('SQLite format 3')).toBe(false);
  await expect(openWebDb(SQL, store, OTHER, 'dc.db')).rejects.toBeInstanceOf(WrongKeyError);
});

test('foreign keys stay on after a save', async () => {
  const { store } = memoryStore();
  const db = await openWebDb(SQL, store, KEY, 'dc.db');
  await db.exec('CREATE TABLE a (id INTEGER PRIMARY KEY); CREATE TABLE b (a_id INTEGER REFERENCES a(id))');
  await expect(db.run('INSERT INTO b (a_id) VALUES (?)', [99])).rejects.toThrow();
});

test('the sync engine works on sql.js (Mac) against the phone database', async () => {
  const { store } = memoryStore();
  const mac = await openWebDb(SQL, store, KEY, 'sync.db');
  await migrate(mac, '1.0.0');
  await ensureSingletons(mac, true);
  const phone = await freshDb();
  expect(await localNode(mac)).toMatch(/^[0-9a-f]{8}$/);
  await updateSettings(mac, { theme: 'dark' });
  await mac.run("INSERT INTO milestone (key, reached_at, created_at) VALUES ('first_week', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')");
  const tomb = await mac.get<{ n: number }>("SELECT count(*) AS n FROM milestone WHERE hlc != ''");
  expect(tomb?.n).toBe(1);
  await applyChangeSet(phone, await buildChangeSet(mac, ''));
  expect((await getSettings(phone)).theme).toBe('dark');
  expect((await phone.all('SELECT key FROM milestone')).length).toBe(1);
  await mac.close();
});
