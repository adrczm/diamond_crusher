import type { Answers, QuestionKey, ScreeningKind } from '../../domain/safety';
import type { Anatomy, SafetyMode } from '../../domain/types';
import { uuid } from '../ids';
import { insert, nowIso, parseJson, type SqlDb, update } from '../sql';

export interface SafetyStateRow {
  mode: SafetyMode;
  reasons: QuestionKey[];
  since: string;
  set_by_run_id: string | null;
  professional_clearance_at: string | null;
  strengthening_paused_reason: 'none' | 'pain_report' | 'screen';
}

export async function ensureSafetyState(db: SqlDb): Promise<void> {
  if (!(await db.get('SELECT id FROM safety_state WHERE id = 1'))) {
    await insert(db, 'safety_state', { id: 1, mode: 'normal', reasons: '[]', since: nowIso() });
  }
}

export async function getSafetyState(db: SqlDb): Promise<SafetyStateRow> {
  const row = await db.get<Record<string, unknown>>('SELECT * FROM safety_state WHERE id = 1');
  if (!row) throw new Error('safety_state missing');
  return { ...(row as unknown as SafetyStateRow), reasons: parseJson<QuestionKey[]>(row.reasons, []) };
}

export async function setSafetyState(
  db: SqlDb,
  s: { mode: SafetyMode; reasons: QuestionKey[]; runId: string | null; clearanceAt?: string | null; pausedReason?: SafetyStateRow['strengthening_paused_reason'] }
): Promise<void> {
  const prev = await getSafetyState(db);
  await update(db, 'safety_state', {
    mode: s.mode,
    reasons: JSON.stringify(s.reasons),
    since: prev.mode === s.mode ? prev.since : nowIso(),
    set_by_run_id: s.runId,
    professional_clearance_at: s.clearanceAt === undefined ? prev.professional_clearance_at : s.clearanceAt,
    strengthening_paused_reason: s.pausedReason ?? (s.mode === 'relax_only' ? prev.strengthening_paused_reason : 'none'),
  }, 'id = 1');
}

export interface ScreeningRunRow {
  id: string;
  kind: ScreeningKind;
  question_set_version: number;
  anatomy_at_run: Anatomy;
  started_at: string;
  completed_at: string | null;
  outcome: SafetyMode | null;
  source_ref: string | null;
}

export async function insertScreeningRun(
  db: SqlDb,
  r: { kind: ScreeningKind; anatomy: Anatomy; startedAt: string; answers: Answers; dates?: Partial<Record<QuestionKey, string>>; outcome: SafetyMode; sourceRef?: string | null }
): Promise<string> {
  const id = uuid();
  const now = nowIso();
  await insert(db, 'screening_run', {
    id,
    kind: r.kind,
    question_set_version: 1,
    anatomy_at_run: r.anatomy,
    started_at: r.startedAt,
    completed_at: now,
    outcome: r.outcome,
    source_ref: r.sourceRef ?? null,
  });
  for (const [key, answer] of Object.entries(r.answers)) {
    if (!answer) continue;
    await insert(db, 'screening_answer', {
      run_id: id,
      question_key: key,
      answer,
      value_date: r.dates?.[key as QuestionKey] ?? null,
      answered_at: now,
    });
  }
  return id;
}

export async function listScreeningRuns(db: SqlDb): Promise<ScreeningRunRow[]> {
  return db.all<ScreeningRunRow>('SELECT * FROM screening_run WHERE completed_at IS NOT NULL ORDER BY completed_at');
}

export async function lastScreeningOfKinds(db: SqlDb, kinds: ScreeningKind[]): Promise<ScreeningRunRow | null> {
  return db.get<ScreeningRunRow>(
    `SELECT * FROM screening_run WHERE completed_at IS NOT NULL AND kind IN (${kinds.map(() => '?').join(',')}) ORDER BY completed_at DESC LIMIT 1`,
    kinds
  );
}

export async function answersForRun(db: SqlDb, runId: string): Promise<Answers> {
  const rows = await db.all<{ question_key: QuestionKey; answer: 'yes' | 'no' | 'skipped' }>(
    'SELECT question_key, answer FROM screening_answer WHERE run_id = ?',
    [runId]
  );
  const out: Answers = {};
  for (const r of rows) out[r.question_key] = r.answer;
  return out;
}

export interface SafetyFlagRow {
  id: string;
  flag_key: string;
  signal_key: string | null;
  raised_at: string;
  source_ref: string | null;
  dismissed_at: string | null;
  response: 'dismissed' | 'will_book' | 'already_seen' | null;
}

export async function raiseFlag(db: SqlDb, flagKey: string, opts: { signalKey?: string | null; sourceRef?: string | null } = {}): Promise<string> {
  const id = uuid();
  await insert(db, 'safety_flag', { id, flag_key: flagKey, signal_key: opts.signalKey ?? null, raised_at: nowIso(), source_ref: opts.sourceRef ?? null });
  return id;
}

export async function listFlags(db: SqlDb): Promise<SafetyFlagRow[]> {
  return db.all<SafetyFlagRow>('SELECT * FROM safety_flag ORDER BY raised_at');
}

export async function openFlags(db: SqlDb): Promise<SafetyFlagRow[]> {
  return db.all<SafetyFlagRow>('SELECT * FROM safety_flag WHERE dismissed_at IS NULL ORDER BY raised_at');
}

export async function respondFlag(db: SqlDb, id: string, response: 'dismissed' | 'will_book' | 'already_seen'): Promise<void> {
  await update(db, 'safety_flag', { dismissed_at: nowIso(), response }, 'id = ?', [id]);
}
