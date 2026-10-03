// Learn the squeeze: saving sittings and technique re-checks (spec 02).
import { addDays, toLocalDate } from '../domain/dates';
import { applySitting, classifyAttempt, sittingResult, type AttemptInput, type LearnProgress, type SittingResult } from '../domain/learn';
import { insertAttempt, setSittingResult } from '../data/repositories/learn';
import { addLevelChange, getProgramme, updateProgramme } from '../data/repositories/programme';
import { updateProfile } from '../data/repositories/profile';
import { newId } from '../data/repositories/sessions';
import { nowIso, type SqlDb } from '../data/sql';
import { clearQG5, profileFacts, raiseQG5 } from './safetyService';

export interface AttemptRecord extends AttemptInput {
  startedAt: string;
  cueKey: string;
  /** LRN-020: an attempt checked with the standing mirror check is a standing attempt. Default: the sitting's. */
  position?: 'lying' | 'standing';
}

/** Days the baseline self-check stays on offer after training starts. Today offers it from the 3rd training day
 * (UX audit C2), so the window must reach well past that. */
export const BASELINE_OFFER_DAYS = 21;

export interface SittingSaved {
  result: SittingResult;
  canStartAnyway: boolean;
  raisedQG5: boolean;
  firstPass: boolean;
}

/** Starts the build phase the first time strengthening unlocks. */
async function startBuild(db: SqlDb, now: Date) {
  const prog = await getProgramme(db);
  if (prog.build_started_on) return;
  await updateProgramme(db, {
    phase: 'build',
    build_started_on: toLocalDate(now),
    baseline_offer_until: addDays(toLocalDate(now), BASELINE_OFFER_DAYS),
  });
  await addLevelChange(db, { reason: 'initial', variable: 'none', before: null, after: null });
  // SX16 (SX-E.20): after prostate treatment, standing unlocks after the first lying pass (PRG-011 exception).
  if (prog.learn_status === 'passed' && prog.position_tier < 2 && (await profileFacts(db, toLocalDate(now))).prostateTreatment) {
    await updateProgramme(db, { position_tier: 2, unlocked_positions: ['lying', 'sitting', 'standing'] });
    await addLevelChange(db, { reason: 'position_unlock', variable: 'position', before: prog.position_tier, after: 2 });
  }
}

export async function saveSitting(
  db: SqlDb,
  attempts: AttemptRecord[],
  kind: 'sitting' | 'recheck',
  position: 'lying' | 'standing',
  now = new Date()
): Promise<SittingSaved> {
  const classes = attempts.map(classifyAttempt);
  const result = sittingResult(classes);
  const sittingId = newId();
  const prog = await getProgramme(db);
  let lastId = '';
  let out: SittingSaved = { result, canStartAnyway: false, raisedQG5: false, firstPass: false };
  await db.transaction(async () => {
    for (let i = 0; i < attempts.length; i++) {
      const a = attempts[i];
      lastId = await insertAttempt(db, {
        sitting_id: sittingId,
        attempt_no: i + 1,
        kind,
        started_at: a.startedAt,
        position: a.position ?? position,
        cue_key: a.cueKey,
        check_mirror: a.checkMirror,
        check_touch: a.checkTouch,
        felt_release: a.feltRelease,
        mistakes: a.mistakes,
        push_down_sign: classes[i].pushDownSign,
        good: classes[i].good,
        result: null,
      });
    }
    if (lastId) await setSittingResult(db, lastId, result);
    if (kind === 'recheck') {
      const again = result !== 'pass' && prog.learn_status === 'unconfirmed_proceeding';
      await updateProgramme(db, {
        last_technique_recheck_at: nowIso(now),
        technique_prompt_at: again ? nowIso(new Date(now.getTime() + 7 * 86400000)) : null,
      });
      if (result === 'pass') {
        if (prog.learn_status !== 'passed') await updateProgramme(db, { learn_status: 'passed', learn_passed_at: nowIso(now) });
        await clearQG5(db);
      }
      out = { result, canStartAnyway: false, raisedQG5: false, firstPass: false };
      return;
    }
    const prev: LearnProgress = {
      status: prog.learn_status,
      unsureSittings: prog.learn_unsure_sittings,
      firstSittingAt: prog.learn_first_sitting_at,
      passedAt: prog.learn_passed_at,
    };
    const o = applySitting(prev, result, now, classes.some((c) => c.pushDownSign));
    await updateProgramme(db, {
      learn_status: o.progress.status,
      learn_unsure_sittings: o.progress.unsureSittings,
      learn_first_sitting_at: o.progress.firstSittingAt,
      learn_passed_at: o.progress.passedAt,
    });
    if (o.raiseQG5) await raiseQG5(db);
    if (result === 'pass') {
      await clearQG5(db);
      await startBuild(db, now);
      const good = attempts.find((_, i) => classes[i].good);
      if (good) await updateProfile(db, { preferred_cue_key: good.cueKey });
    }
    out = { result, canStartAnyway: o.canStartAnyway, raisedQG5: o.raiseQG5, firstPass: result === 'pass' && prev.status !== 'passed' };
  });
  return out;
}

/** LRN-032: "Start training anyway" after unsure sittings. Weekly technique prompts follow. */
export async function startAnyway(db: SqlDb, now = new Date()): Promise<void> {
  await updateProgramme(db, { learn_status: 'unconfirmed_proceeding', technique_prompt_at: nowIso(new Date(now.getTime() + 7 * 86400000)) });
  await startBuild(db, now);
}

/** LRN-040: the stop test card was shown. It is information only (UX audit M9), so no result is stored (null). */
export async function markStopTestShown(db: SqlDb): Promise<void> {
  await updateProgramme(db, { stop_test_shown_at: nowIso(), stop_test_result: null });
}

export async function setPreferredCue(db: SqlDb, cueKey: string): Promise<void> {
  await updateProfile(db, { preferred_cue_key: cueKey });
}
