// Schema version 4: women's profile, bowel goal and the men-and-women research changes (decisions of 2026-10-03).
// - New goals: bowel control (everyone, SX5/SX23), pregnancy and after birth, sexual function (female, SX3).
// - Learn the squeeze keeps the optional inside check for the female profile (02 LRN-023).
// - Relaxation-only mode unlocks a gentle squeeze after a full let-go, and locks it again after exercise pain (03 ENG-061).
// - A sexual activity entry can record a leak at orgasm or when aroused (06a EVT-034, male after prostate treatment).
import type { SqlDb } from '../sql';
import { fieldTriggers, rowTriggers } from './0002_sync';
import { rebuild } from './0003_round2';

export async function up(db: SqlDb): Promise<void> {
  await rebuild(db, 'profile_goal', (sql) =>
    sql.replace("'long_term_health')", "'long_term_health', 'bowel_control', 'pregnancy_birth', 'sexual_function')")
  );
  await rowTriggers(db, 'profile_goal', false);

  await db.exec(
    `ALTER TABLE learn_attempt ADD COLUMN check_inside TEXT CHECK (check_inside IS NULL OR check_inside IN ('lifted', 'pushed', 'nothing', 'unsure', 'not_done'));`
  );
  await rowTriggers(db, 'learn_attempt', false);

  await db.exec(`
ALTER TABLE programme_state ADD COLUMN gentle_unlocked_at TEXT;
ALTER TABLE programme_state ADD COLUMN gentle_pain_lock INTEGER NOT NULL DEFAULT 0 CHECK (gentle_pain_lock IN (0, 1));
`);
  await fieldTriggers(db, 'programme_state');

  await db.exec(`ALTER TABLE event ADD COLUMN orgasm_leak TEXT CHECK (orgasm_leak IS NULL OR orgasm_leak IN ('yes', 'no'));`);
  await rowTriggers(db, 'event', false);
}
