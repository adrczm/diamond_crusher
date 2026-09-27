import { ensureProgramme } from './repositories/programme';
import { ensureProfile } from './repositories/profile';
import { ensureSafetyState } from './repositories/safety';
import { ensureSettings } from './repositories/settings';
import { logDataOp } from './repositories/misc';
import type { SqlDb } from './sql';

/** Creates the single-row tables on first run. No personal data is created (PRIV-041). */
export async function ensureSingletons(db: SqlDb, firstRun: boolean): Promise<void> {
  await db.transaction(async () => {
    await ensureProfile(db);
    await ensureSettings(db);
    await ensureSafetyState(db);
    await ensureProgramme(db);
    if (firstRun) await logDataOp(db, 'created', { schema: 1 });
  });
}
