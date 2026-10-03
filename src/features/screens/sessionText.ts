// Words on the session screen (spec 03), kept apart from the screen so they can be tested.
import { BLOCK_NAME, GENTLE_SQUEEZE, INTENSITY, PHASE_TEXT, RELAX_STEP_TEXT, SESSION } from '../../content/en/exercise';
import type { BlockType, TimelinePhase } from '../../domain/session/plan';
import type { NextUp } from '../../domain/session/shape';

export function phaseTitle(p: TimelinePhase | null): string {
  if (!p) return '';
  if (p.kind === 'relax') return RELAX_STEP_TEXT[p.relaxStep ?? 'relax_in'].title;
  if (p.kind === 'transition') return PHASE_TEXT.transition;
  return PHASE_TEXT[p.kind];
}

export function repText(block: BlockType, rep: number, reps: number): string {
  if (block === 'hold') return SESSION.holdLabel(rep, reps);
  if (block === 'flick') return SESSION.flickLabel(rep, reps);
  if (block === 'endurance') return SESSION.enduranceLabel(rep, reps);
  return SESSION.repCount(rep, reps);
}

export function repLabel(p: TimelinePhase | null): string {
  if (!p || p.rep === 0) return '';
  if (p.gentle) return GENTLE_SQUEEZE.label(p.rep, p.reps);
  return repText(p.block, p.rep, p.reps);
}

/** The block name over the timer. The gentle squeeze (ENG-061) has its own name. */
export function blockName(p: TimelinePhase | null): string {
  if (!p) return '';
  return p.gentle ? GENTLE_SQUEEZE.name : BLOCK_NAME[p.block];
}

/** How hard to squeeze, shown while squeezing. */
export function intensityText(p: TimelinePhase): string {
  return p.gentle ? GENTLE_SQUEEZE.intensity : INTENSITY[p.block];
}

/** MO-7, HE-14: "Next: Hold 4 of 8", or "Next: Quick squeezes" on the last rest of a block. Empty otherwise. */
export function nextText(n: NextUp): string {
  if (!n) return '';
  if (n.kind === 'block') return SESSION.nextBlock[n.block];
  return SESSION.nextRep(repText(n.block, n.rep, n.reps));
}
