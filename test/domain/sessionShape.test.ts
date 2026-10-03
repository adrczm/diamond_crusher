// Session timer shapes (spec 03 session screen; motion MO-1 to MO-7; Adrian T2, D1, D2, 2026-10-03).
import { SessionRunner } from '../../src/domain/session/engine';
import { DEFAULT_LOAD, relaxPlan, strengthPlan, timeline, type TimelinePhase } from '../../src/domain/session/plan';
import {
  blockSpans,
  breath,
  breathStep,
  ease,
  HOLD_LEVEL,
  indexAt,
  level,
  levelAt,
  nextUp,
  placeAll,
  ringStep,
  STEADY_LEVEL,
  waveWindow,
  type Placed,
} from '../../src/domain/session/shape';
import { nextText, phaseTitle, repLabel } from '../../src/features/screens/sessionText';
import { mixColor } from '../../src/ui/mix';

const ph = (kind: TimelinePhase['kind'], block: TimelinePhase['block'], durationS: number): TimelinePhase => ({ kind, block, blockIndex: 1, rep: 1, reps: 8, durationS });

function placed(plan = strengthPlan(DEFAULT_LOAD, false, 'lying')): Placed[] {
  let t = 0;
  return timeline(plan).map((phase) => {
    const p = { phase, startS: t };
    t += phase.durationS;
    return p;
  });
}

describe('muscle shape (T2, D2)', () => {
  it('a hold spikes up in 0.2 s, then settles flat by 0.6 s', () => {
    const hold = ph('squeeze', 'hold', 3);
    expect(level(hold, 0)).toBe(0);
    expect(level(hold, 0.2)).toBeCloseTo(1, 5);
    expect(level(hold, 0.6)).toBeCloseTo(HOLD_LEVEL, 5);
    expect(level(hold, 2.9)).toBeCloseTo(HOLD_LEVEL, 5);
    // Rises fast, never above the peak.
    for (let u = 0; u <= 3; u += 0.05) expect(level(hold, u)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('a quick squeeze rises in 0.25 s and keeps a short flat top', () => {
    const flick = ph('squeeze', 'flick', 1);
    expect(level(flick, 0.125)).toBeCloseTo(0.5, 5);
    expect(level(flick, 0.25)).toBe(1);
    expect(level(flick, 0.9)).toBe(1);
  });

  it('a steady hold rises over 0.6 s to half strength', () => {
    const steady = ph('squeeze', 'endurance', 5);
    expect(level(steady, 0.3)).toBeLessThan(STEADY_LEVEL);
    expect(level(steady, 0.6)).toBeCloseTo(STEADY_LEVEL, 5);
    expect(level(steady, 4)).toBeCloseTo(STEADY_LEVEL, 5);
  });

  it('the let-go eases down across the whole 2 s, from the level of the squeeze', () => {
    const rel = ph('release', 'hold', 2);
    expect(level(rel, 0)).toBeCloseTo(HOLD_LEVEL, 5);
    expect(level(rel, 1)).toBeCloseTo(HOLD_LEVEL / 2, 5);
    expect(level(rel, 1.9)).toBeGreaterThan(0);
    expect(level(rel, 2)).toBeCloseTo(0, 5);
    expect(level(ph('release', 'flick', 2), 0)).toBeCloseTo(1, 5);
    let prev = Infinity;
    for (let u = 0; u <= 2; u += 0.1) {
      expect(level(rel, u)).toBeLessThanOrEqual(prev);
      prev = level(rel, u);
    }
  });

  it('rest and get ready are flat, relax breathes a little', () => {
    expect(level(ph('rest', 'hold', 3), 1)).toBe(0);
    expect(level(ph('transition', 'hold', 5), 2)).toBe(0);
    expect(level(ph('relax', 'relax', 30), 4)).toBeCloseTo(0.1, 5);
  });

  it('flows without a jump from squeeze to let-go on the session clock', () => {
    const list = placed();
    const sq = list.find((p) => p.phase.kind === 'squeeze' && p.phase.block === 'hold')!;
    const end = sq.startS + sq.phase.durationS;
    expect(Math.abs(levelAt(list, end - 1e-6) - levelAt(list, end + 1e-6))).toBeLessThan(0.01);
    expect(levelAt(list, -1)).toBe(0);
  });
});

describe('breathing pacer (D1, MO-4)', () => {
  it('breathes in for 4 s and out for 6 s', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(breath(0)).toBe(0);
    expect(breath(4)).toBeCloseTo(1, 5);
    expect(breath(7)).toBeCloseTo(0.5, 5);
    expect(breath(10)).toBeCloseTo(0, 5);
    expect(breathStep(3.9)).toBe('in');
    expect(breathStep(4.1)).toBe('out');
    expect(breathStep(14.5)).toBe('out');
    expect(breathStep(20.5)).toBe('in');
  });
});

describe('ring step (MO-1, MO-2)', () => {
  it('fills while squeezing, drains over the let-go while the blue fades, grey counts rest', () => {
    expect(ringStep('squeeze', 1.5, 3)).toEqual({ fill: 0.5, tone: 'squeeze', mix: 0 });
    const half = ringStep('release', 1, 2);
    expect(half.fill).toBeCloseTo(0.5, 5);
    expect(half.mix).toBeCloseTo(0.5, 5);
    expect(ringStep('release', 2, 2).fill).toBeCloseTo(0, 5);
    expect(ringStep('rest', 1.5, 3)).toEqual({ fill: 0.5, tone: 'rest', mix: 1 });
  });
});

describe('session blocks and the wave window', () => {
  it('splits the session into blocks, Get ready with the block it opens', () => {
    const list = placed();
    const spans = blockSpans(list);
    expect(spans.map((s) => s.block)).toEqual(['relax', 'hold', 'flick', 'relax']);
    expect(spans[0]).toMatchObject({ startS: 0, endS: 30 });
    // Holds: 5 s get ready + 8 x (3 + 2 + 3).
    expect(spans[1]).toMatchObject({ startS: 30, endS: 30 + 5 + 64 });
    const total = list[list.length - 1].startS + list[list.length - 1].phase.durationS;
    expect(spans[spans.length - 1].endS).toBe(total);
  });

  it('finds the phase at a time and walks forward from a hint', () => {
    const list = placed();
    expect(indexAt(list, -0.1)).toBe(-1);
    expect(indexAt(list, 0)).toBe(0);
    expect(indexAt(list, 35)).toBe(2);
    expect(indexAt(list, 35, 2)).toBe(2);
    expect(indexAt(list, 0, 5)).toBe(0);
  });

  it('scrolls with now at about a third, or shows the whole block still with Reduce motion', () => {
    const spans = blockSpans(placed());
    const [a, b] = waveWindow(50, 14, 0.32, false, spans);
    expect(b - a).toBe(14);
    expect(50 - a).toBeCloseTo(14 * 0.32, 5);
    expect(waveWindow(50, 14, 0.32, true, spans)).toEqual([29, 30 + 69 + 1]);
    expect(waveWindow(50.5, 14, 0.32, true, spans)).toEqual(waveWindow(50, 14, 0.32, true, spans));
  });

  it('reads the runner schedule, cut phases included, after Getting weak', () => {
    const r = new SessionRunner(strengthPlan(DEFAULT_LOAD, false, 'lying'));
    r.start(0);
    r.tick(36_000);
    r.gettingWeak(36_000);
    const list = placeAll(r.schedule());
    const spans = blockSpans(list);
    expect(spans.map((s) => s.block)).toEqual(['relax', 'hold', 'flick', 'relax']);
    expect(spans[1].endS).toBeCloseTo(36, 5);
    expect(list[r.currentIndex()].phase.kind).toBe('transition');
  });
});

describe('next-rep preview (MO-7, HE-14)', () => {
  const list = placed();
  const find = (f: (p: TimelinePhase) => boolean) => list.findIndex((p) => f(p.phase));

  it('says the next hold during a rest', () => {
    const i = find((p) => p.kind === 'rest' && p.block === 'hold' && p.rep === 3);
    expect(nextText(nextUp(list, i))).toBe('Next: Hold 4 of 8');
  });

  it('says the next exercise on the last rest of a block', () => {
    const i = find((p) => p.kind === 'rest' && p.block === 'hold' && p.rep === 8);
    expect(nextText(nextUp(list, i))).toBe('Next: Quick squeezes');
  });

  it('says the first rep during Get ready', () => {
    const i = find((p) => p.kind === 'transition' && p.block === 'flick');
    expect(nextText(nextUp(list, i))).toBe('Next: Quick squeeze 1 of 10');
  });

  it('says nothing while squeezing or letting go', () => {
    expect(nextUp(list, find((p) => p.kind === 'squeeze'))).toBeNull();
    expect(nextText(nextUp(list, find((p) => p.kind === 'release')))).toBe('');
  });

  it('has no next rep in a relax-only session', () => {
    const relax = placed(relaxPlan());
    expect(relax.every((_, i) => nextUp(relax, i) === null)).toBe(true);
  });

  it('keeps the phase and rep words', () => {
    expect(phaseTitle(null)).toBe('');
    expect(phaseTitle(list[1].phase)).toBe('Get ready');
    expect(repLabel(list[2].phase)).toBe('Hold 1 of 8');
    expect(repLabel(list[0].phase)).toBe('');
  });
});

describe('colour cross-fade (MO-5)', () => {
  it('mixes two theme colours', () => {
    expect(mixColor('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixColor('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixColor('#005BD3', '#616161', 2)).toBe('#616161');
  });
});
