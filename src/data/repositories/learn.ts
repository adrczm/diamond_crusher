import type { Mistakes, MirrorCheck, SittingResult, TouchCheck } from '../../domain/learn';
import { uuid } from '../ids';
import { bool, fromBool, insert, parseJson, type SqlDb, update } from '../sql';

export interface LearnAttemptRow {
  id: string;
  sitting_id: string;
  attempt_no: number;
  kind: 'sitting' | 'recheck';
  started_at: string;
  position: 'lying' | 'standing';
  cue_key: string;
  check_mirror: MirrorCheck;
  check_touch: TouchCheck;
  felt_release: 'yes' | 'no' | 'unsure' | null;
  mistakes: Mistakes;
  push_down_sign: boolean;
  good: boolean;
  result: SittingResult | null;
}

export async function insertAttempt(db: SqlDb, a: Omit<LearnAttemptRow, 'id'>): Promise<string> {
  const id = uuid();
  await insert(db, 'learn_attempt', {
    id,
    sitting_id: a.sitting_id,
    attempt_no: a.attempt_no,
    kind: a.kind,
    started_at: a.started_at,
    position: a.position,
    cue_key: a.cue_key,
    check_mirror: a.check_mirror,
    check_touch: a.check_touch,
    felt_release: a.felt_release,
    mistakes: JSON.stringify(a.mistakes),
    push_down_sign: bool(a.push_down_sign),
    good: bool(a.good),
    result: a.result,
  });
  return id;
}

export async function setSittingResult(db: SqlDb, attemptId: string, result: SittingResult): Promise<void> {
  await update(db, 'learn_attempt', { result }, 'id = ?', [attemptId]);
}

export async function listAttempts(db: SqlDb): Promise<LearnAttemptRow[]> {
  const rows = await db.all<Record<string, unknown>>('SELECT * FROM learn_attempt ORDER BY started_at, attempt_no');
  return rows.map((r) => ({
    ...(r as unknown as LearnAttemptRow),
    mistakes: parseJson<Mistakes>(r.mistakes, {} as Mistakes),
    push_down_sign: fromBool(r.push_down_sign),
    good: fromBool(r.good),
  }));
}
