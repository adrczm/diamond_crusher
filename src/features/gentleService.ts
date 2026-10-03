// Relaxation-only mode with a gentle squeeze (03 ENG-061; SX13, SX21, SX22, SX26; Adrian, 2026-10-03).
import { getProgramme, updateProgramme } from '../data/repositories/programme';
import { getSafetyState } from '../data/repositories/safety';
import { nowIso, type SqlDb } from '../data/sql';

export type GentleState = 'off' | 'ask' | 'on' | 'pain_locked';

/**
 * Where the gentle squeeze stands. Only in relaxation-only mode: `ask` until the person says they feel a full let-go,
 * then `on`. Pain from the exercises themselves (Q-P4 or the Pain button) locks it until they say the pain has gone.
 */
export function gentleState(mode: string, unlockedAt: string | null, painLock: boolean): GentleState {
  if (mode !== 'relax_only') return 'off';
  if (painLock) return 'pain_locked';
  return unlockedAt ? 'on' : 'ask';
}

export async function loadGentleState(db: SqlDb): Promise<GentleState> {
  const [safety, prog] = await Promise.all([getSafetyState(db), getProgramme(db)]);
  return gentleState(safety.mode, prog.gentle_unlocked_at, prog.gentle_pain_lock);
}

/** "Yes, I can" to "Can you feel a full let-go?": the next relax sessions add the gentle squeeze block. */
export async function confirmLetGo(db: SqlDb): Promise<void> {
  await updateProgramme(db, { gentle_unlocked_at: nowIso() });
}

/** "The pain has gone": the gentle squeeze comes back (SX22). */
export async function painGone(db: SqlDb): Promise<void> {
  await updateProgramme(db, { gentle_pain_lock: false });
}
