import type { AgeBand, Anatomy, Goal } from '../../domain/types';
import { fromBool, insert, nowIso, type SqlDb, update } from '../sql';

export interface ProfileRow {
  nickname: string | null;
  anatomy: Anatomy | null;
  preferred_cue_key: string | null;
  disclaimer_ack_version: number | null;
  disclaimer_ack_at: string | null;
  adult_confirmed_at: string | null;
  age_band: AgeBand | null;
  expectations_ack_at: string | null;
  onboarding_completed_at: string | null;
  onboarding_step: number;
  locale: string;
  created_at: string;
}

export async function getProfile(db: SqlDb): Promise<ProfileRow | null> {
  return db.get<ProfileRow>('SELECT * FROM profile WHERE id = 1');
}

export async function ensureProfile(db: SqlDb): Promise<void> {
  if (!(await getProfile(db))) await insert(db, 'profile', { id: 1, onboarding_step: 0, locale: 'en' });
}

export async function updateProfile(db: SqlDb, patch: Partial<Omit<ProfileRow, 'created_at'>>): Promise<void> {
  await update(db, 'profile', patch, 'id = 1');
}

export interface GoalRow {
  goal: Goal;
  added_at: string;
  active: boolean;
}

export async function getGoals(db: SqlDb): Promise<GoalRow[]> {
  const rows = await db.all<{ goal: Goal; added_at: string; active: number }>('SELECT goal, added_at, active FROM profile_goal ORDER BY added_at');
  return rows.map((r) => ({ ...r, active: fromBool(r.active) }));
}

export async function activeGoals(db: SqlDb): Promise<Goal[]> {
  return (await getGoals(db)).filter((g) => g.active).map((g) => g.goal);
}

/** Removing a goal keeps its history (DATA-032). */
export async function setGoals(db: SqlDb, goals: Goal[]): Promise<void> {
  const existing = await getGoals(db);
  const now = nowIso();
  for (const g of goals) {
    if (existing.some((e) => e.goal === g)) await update(db, 'profile_goal', { active: 1 }, 'goal = ?', [g]);
    else await insert(db, 'profile_goal', { goal: g, added_at: now, active: 1 });
  }
  for (const e of existing) if (!goals.includes(e.goal)) await update(db, 'profile_goal', { active: 0 }, 'goal = ?', [e.goal]);
}
