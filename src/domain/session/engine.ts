// Session runner: a pure state machine driven by a monotonic clock (ARCH-030).
// Phase boundaries are computed from the start time, so timing never drifts across phases.
import type { Completion } from '../types';
import { type PlannedBlock, type SessionPlan, type TimelinePhase, timeline } from './plan';

export type EndReason = 'completed' | 'quality_drop' | 'user_stop' | 'pain' | 'interrupted';

export interface BlockResult {
  seq: number;
  block: 'relax_open' | 'hold' | 'flick' | 'endurance' | 'relax_close' | 'breathing';
  plannedReps: number;
  plannedHoldS: number;
  plannedRestS: number;
  completedReps: number;
  endReason: EndReason;
}

export type RunnerEvent =
  | { type: 'phase'; phase: TimelinePhase; index: number }
  | { type: 'finished'; completion: Completion };

export type RunnerState = 'ready' | 'running' | 'paused' | 'finished';

interface Segment {
  phase: TimelinePhase;
  startMs: number; // offset from session start (active time)
  /** Cut short by a button press; a cut squeeze doesn't count as a rep. */
  cut?: boolean;
}

export class SessionRunner {
  readonly plan: SessionPlan;
  private segments: Segment[] = [];
  private totalMs = 0;
  private state: RunnerState = 'ready';
  private startMono = 0;
  private pausedAt = 0;
  private pausedTotal = 0;
  private current = -1;
  private qualityStop = false;
  private skippedRelaxOut = false;
  private stoppedEarly = false;
  private pain = false;
  private completedReps = new Map<number, number>();
  private blockEndReason = new Map<number, EndReason>();

  constructor(plan: SessionPlan) {
    this.plan = plan;
    this.rebuild(timeline(plan), 0);
  }

  private rebuild(phases: TimelinePhase[], fromMs: number) {
    let t = fromMs;
    const kept = this.segments;
    const next: Segment[] = phases.map((phase) => {
      const seg = { phase, startMs: t };
      t += phase.durationS * 1000;
      return seg;
    });
    this.segments = kept.concat(next);
    this.totalMs = t;
  }

  getState(): RunnerState {
    return this.state;
  }

  start(nowMono: number): RunnerEvent[] {
    if (this.state !== 'ready') return [];
    this.state = 'running';
    this.startMono = nowMono;
    return this.tick(nowMono);
  }

  /** Active elapsed ms, excluding pauses (ARCH-031). */
  elapsedMs(nowMono: number): number {
    if (this.state === 'ready') return 0;
    const end = this.state === 'paused' ? this.pausedAt : nowMono;
    return Math.min(this.totalMs, end - this.startMono - this.pausedTotal);
  }

  pause(nowMono: number) {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.pausedAt = nowMono;
  }

  resume(nowMono: number) {
    if (this.state !== 'paused') return;
    this.pausedTotal += nowMono - this.pausedAt;
    this.state = 'running';
  }

  currentIndex(): number {
    return this.current;
  }

  currentPhase(): TimelinePhase | null {
    return this.current >= 0 && this.current < this.segments.length ? this.segments[this.current].phase : null;
  }

  /** Seconds left in the current phase. */
  phaseRemainingS(nowMono: number): number {
    if (this.current < 0 || this.current >= this.segments.length) return 0;
    const seg = this.segments[this.current];
    const end = seg.startMs + seg.phase.durationS * 1000;
    return Math.max(0, (end - this.elapsedMs(nowMono)) / 1000);
  }

  totalS(): number {
    return this.totalMs / 1000;
  }

  tick(nowMono: number): RunnerEvent[] {
    if (this.state !== 'running') return [];
    const events: RunnerEvent[] = [];
    const t = this.elapsedMs(nowMono);
    let idx = this.current;
    while (idx + 1 < this.segments.length && this.segments[idx + 1].startMs <= t) {
      idx++;
      this.onLeave(this.current);
      this.current = idx;
      events.push({ type: 'phase', phase: this.segments[idx].phase, index: idx });
    }
    if (t >= this.totalMs) {
      this.onLeave(this.current);
      this.current = this.segments.length;
      this.state = 'finished';
      events.push({ type: 'finished', completion: this.completion() });
    }
    return events;
  }

  /** Counts a rep as done once its squeeze phase has fully run. */
  private onLeave(index: number) {
    if (index < 0 || index >= this.segments.length) return;
    const seg = this.segments[index];
    const p = seg.phase;
    if (p.kind === 'squeeze' && !seg.cut) {
      this.completedReps.set(p.blockIndex, Math.max(this.completedReps.get(p.blockIndex) ?? 0, p.rep));
    }
  }

  private jumpTo(nowMono: number, phases: TimelinePhase[]) {
    const t = this.elapsedMs(nowMono);
    // Cut the current phase at "now" and continue with the given phases.
    if (this.current >= 0 && this.current < this.segments.length) {
      const seg = this.segments[this.current];
      seg.phase = { ...seg.phase, durationS: (t - seg.startMs) / 1000 };
      seg.cut = true;
    }
    this.segments = this.segments.slice(0, this.current + 1);
    this.rebuild(phases, t);
  }

  private remainingPhasesAfterBlock(blockIndex: number): TimelinePhase[] {
    return timeline(this.plan).filter((p) => p.blockIndex > blockIndex);
  }

  /** ENG-020: "Getting weak" ends the current hold or flick block and moves on. */
  gettingWeak(nowMono: number): RunnerEvent[] {
    const p = this.currentPhase();
    if (this.state !== 'running' || !p || (p.block !== 'hold' && p.block !== 'flick')) return [];
    this.qualityStop = true;
    this.blockEndReason.set(p.blockIndex, 'quality_drop');
    // The rep being squeezed when the button is pressed doesn't count.
    this.jumpTo(nowMono, this.remainingPhasesAfterBlock(p.blockIndex));
    return this.tick(nowMono);
  }

  private relaxOutPhases(): TimelinePhase[] {
    const last = this.plan.blocks.length - 1;
    const b = this.plan.blocks[last];
    if (b.type !== 'relax' || b.relaxStep !== 'relax_out') return [];
    return timeline(this.plan).filter((p) => p.blockIndex === last && p.kind === 'relax');
  }

  /** Early exit (user stop or pain): end contractions now and play the relax-out (ENG-012). */
  stopEarly(nowMono: number, reason: 'user_stop' | 'pain'): RunnerEvent[] {
    if (this.state === 'finished') return [];
    if (this.state === 'paused') this.resume(nowMono);
    if (this.state === 'ready') this.start(nowMono);
    const p = this.currentPhase();
    this.stoppedEarly = true;
    if (reason === 'pain') this.pain = true;
    if (p) this.blockEndReason.set(p.blockIndex, reason);
    const inRelaxOut = p?.relaxStep === 'relax_out';
    if (!inRelaxOut) this.jumpTo(nowMono, this.relaxOutPhases());
    return this.tick(nowMono);
  }

  /** ENG-012a: a confirmed "End session" closes the session at once, with no relax-out (Adrian, 2026-09-29). */
  endNow(nowMono: number): RunnerEvent[] {
    const events = this.stopEarly(nowMono, 'user_stop');
    if (this.state === 'finished') return events;
    return events.concat(this.skipRelaxOut(nowMono));
  }

  /** ONB-040: the user confirmed the stop was pain, not tired muscles. */
  markPain() {
    this.pain = true;
    for (const [k, v] of this.blockEndReason) if (v === 'user_stop') this.blockEndReason.set(k, 'pain');
  }

  /** Skip the relax-out: the session becomes partial (ENG-021). */
  skipRelaxOut(nowMono: number): RunnerEvent[] {
    const p = this.currentPhase();
    if (this.state !== 'running' || !p || p.relaxStep !== 'relax_out') return [];
    this.skippedRelaxOut = true;
    this.jumpTo(nowMono, []);
    return this.tick(nowMono);
  }

  /** ENG-021. */
  completion(): Completion {
    if (this.pain) return 'stopped_pain';
    if (this.qualityStop || this.stoppedEarly || this.skippedRelaxOut) return 'partial';
    return 'complete';
  }

  /** Per-block results for `exercise_set`. */
  results(): BlockResult[] {
    const lastIdx = this.plan.blocks.length - 1;
    const reached = new Set(this.segments.slice(0, Math.max(0, this.current + 1)).map((s) => s.phase.blockIndex));
    return this.plan.blocks.map((b: PlannedBlock, i) => {
      const block: BlockResult['block'] =
        b.type === 'relax' ? (i === 0 ? 'relax_open' : i === lastIdx ? 'relax_close' : 'breathing') : b.type;
      const completedReps = b.type === 'relax' ? (reached.has(i) ? 1 : 0) : this.completedReps.get(i) ?? 0;
      const explicit = this.blockEndReason.get(i);
      let endReason: EndReason;
      if (explicit) endReason = explicit;
      else if (b.type === 'relax') endReason = completedReps ? 'completed' : this.stoppedEarly ? 'user_stop' : 'interrupted';
      else endReason = completedReps >= b.reps ? 'completed' : this.stoppedEarly ? 'user_stop' : 'interrupted';
      return {
        seq: i,
        block,
        plannedReps: b.type === 'relax' ? 1 : b.reps,
        plannedHoldS: b.type === 'relax' ? b.durationS ?? 0 : b.onS,
        plannedRestS: b.releaseS + b.restS,
        completedReps: b.type === 'relax' ? Math.min(1, completedReps) : completedReps,
        endReason,
      };
    });
  }
}
