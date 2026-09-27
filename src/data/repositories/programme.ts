import type { Category, ChangeReason, ChangeVariable, Prescription, StrengthVar } from '../../domain/progression';
import type { LearnStatus, Phase, Position } from '../../domain/types';
import { uuid } from '../ids';
import { fromBool, insert, nowIso, parseJson, type SqlDb, type SqlValue, update } from '../sql';

export interface ProgrammeRow {
  phase: Phase;
  learn_status: LearnStatus;
  learn_unsure_sittings: number;
  learn_first_sitting_at: string | null;
  learn_passed_at: string | null;
  stop_test_shown_at: string | null;
  stop_test_result: 'could' | 'could_not' | 'skipped' | null;
  last_technique_recheck_at: string | null;
  technique_prompt_at: string | null;
  build_started_on: string | null;
  active_days: number;
  maintenance_since: string | null;
  hold_s: number;
  hold_reps: number;
  flick_reps: number;
  endurance_enabled: boolean;
  endurance_hold_s: number;
  unlocked_positions: Position[];
  position_tier: number;
  hold_ceiling: number;
  last_category: Category | null;
  rotation_index: number;
  last_strength_variable: StrengthVar | null;
  tier2_qualifying_weeks: number;
  regression_hold_until: string | null;
  keep_building_until_active_day: number | null;
  return_to_build_until_active_day: number | null;
  template_key: string;
  template_version: number;
  planned_surgery_date: string | null;
  last_session_date: string | null;
  last_evaluated_at: string | null;
  last_evaluated_week: number;
  baseline_offer_until: string | null;
  knack_taught_at: string | null;
}

export async function ensureProgramme(db: SqlDb): Promise<void> {
  if (!(await db.get('SELECT id FROM programme_state WHERE id = 1'))) await insert(db, 'programme_state', { id: 1 });
}

export async function getProgramme(db: SqlDb): Promise<ProgrammeRow> {
  const row = await db.get<Record<string, unknown>>('SELECT * FROM programme_state WHERE id = 1');
  if (!row) throw new Error('programme_state missing');
  return {
    ...(row as unknown as ProgrammeRow),
    endurance_enabled: fromBool(row.endurance_enabled),
    unlocked_positions: parseJson<Position[]>(row.unlocked_positions, ['lying']),
  };
}

export async function updateProgramme(db: SqlDb, patch: Partial<ProgrammeRow>): Promise<void> {
  const row: Record<string, SqlValue> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (typeof v === 'boolean') row[k] = v ? 1 : 0;
    else if (Array.isArray(v)) row[k] = JSON.stringify(v);
    else row[k] = v as SqlValue;
  }
  await update(db, 'programme_state', row, 'id = 1');
}

export function toPrescription(p: ProgrammeRow): Prescription {
  return {
    holdS: p.hold_s,
    holdReps: p.hold_reps,
    flickReps: p.flick_reps,
    enduranceEnabled: p.endurance_enabled,
    enduranceHoldS: p.endurance_hold_s,
    tier: p.position_tier,
    holdCeiling: p.hold_ceiling,
    rotationIndex: p.rotation_index,
    lastCategory: p.last_category,
    lastStrengthVariable: p.last_strength_variable,
    tier2QualifyingWeeks: p.tier2_qualifying_weeks,
  };
}

export function fromPrescription(p: Prescription): Partial<ProgrammeRow> {
  const unlocked: Position[] = p.tier <= 0 ? ['lying'] : p.tier === 1 ? ['lying', 'sitting'] : ['lying', 'sitting', 'standing'];
  return {
    hold_s: p.holdS,
    hold_reps: p.holdReps,
    flick_reps: p.flickReps,
    endurance_enabled: p.enduranceEnabled,
    endurance_hold_s: p.enduranceHoldS,
    position_tier: p.tier,
    hold_ceiling: p.holdCeiling,
    rotation_index: p.rotationIndex,
    last_category: p.lastCategory,
    last_strength_variable: p.lastStrengthVariable,
    tier2_qualifying_weeks: p.tier2QualifyingWeeks,
    unlocked_positions: unlocked,
  };
}

export interface LevelChangeRow {
  id: string;
  at: string;
  reason: ChangeReason;
  variable: ChangeVariable;
  before: unknown;
  after: unknown;
  evidence_ref: string | null;
}

export async function addLevelChange(
  db: SqlDb,
  c: { reason: ChangeReason; variable: ChangeVariable; before: unknown; after: unknown; evidenceRef?: string | null; at?: string }
): Promise<void> {
  await insert(db, 'level_change', {
    id: uuid(),
    at: c.at ?? nowIso(),
    reason: c.reason,
    variable: c.variable,
    before: JSON.stringify(c.before ?? null),
    after: JSON.stringify(c.after ?? null),
    evidence_ref: c.evidenceRef ?? null,
  });
}

export async function listLevelChanges(db: SqlDb): Promise<LevelChangeRow[]> {
  const rows = await db.all<Record<string, unknown>>('SELECT * FROM level_change ORDER BY at, created_at');
  return rows.map((r) => ({
    ...(r as unknown as LevelChangeRow),
    before: parseJson<unknown>(r.before, null),
    after: parseJson<unknown>(r.after, null),
  }));
}
