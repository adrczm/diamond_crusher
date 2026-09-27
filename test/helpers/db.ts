import { ensureSingletons } from '../../src/data/init';
import { migrate } from '../../src/data/migrate';
import { openNodeDb } from '../../src/data/nodeSql';

export async function freshDb() {
  const db = openNodeDb();
  await migrate(db, 'test');
  await ensureSingletons(db, true);
  return db;
}
