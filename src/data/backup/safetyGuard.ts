// Imports and safety (decision 2, 2026-09-29).
import type { SafetyMode } from '../../domain/types';
import type { SqlDb, SqlValue } from '../sql';

/** Strictness order of the safety modes: a higher number stops more training. */
const STRICT: Record<SafetyMode, number> = { normal: 0, caution: 1, relax_only: 2, blocked_until_cleared: 3, blocked_urgent: 4 };

/**
 * Decision 2 (2026-09-29): an import never loosens safety. If the imported mode is less strict than the mode on this
 * device, and was set no later, the device's own safety state stays. A newer, looser state (for example after a
 * professional said it is OK) still comes through.
 */
export async function keepStricterSafety(db: SqlDb, before: Record<string, SqlValue> | null): Promise<boolean> {
  if (!before) return false;
  const after = await db.get<Record<string, SqlValue>>('SELECT * FROM safety_state WHERE id = 1');
  if (!after) {
    await insertRow(db, 'safety_state', before);
    return true;
  }
  const looser = STRICT[after.mode as SafetyMode] < STRICT[before.mode as SafetyMode];
  const notNewer = String(after.since ?? '') <= String(before.since ?? '');
  if (!looser || !notNewer) return false;
  const cols = Object.keys(before).filter((k) => k !== 'id');
  await db.run(`UPDATE safety_state SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = 1`, cols.map((k) => before[k]));
  return true;
}

async function insertRow(db: SqlDb, table: string, row: Record<string, SqlValue>) {
  const keys = Object.keys(row);
  await db.run(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, keys.map((k) => row[k]));
}
