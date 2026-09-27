// Shared domain types. Names follow spec 07 (tables and enums).

export type Anatomy = 'male' | 'female' | 'other_unspecified';
export type Goal = 'bladder_control' | 'ejaculatory_control' | 'erection' | 'long_term_health';
export type AgeBand = '18_29' | '30_44' | '45_59' | '60_74' | '75_plus';

export type SafetyMode = 'normal' | 'caution' | 'relax_only' | 'blocked_until_cleared' | 'blocked_urgent';

export type Position = 'lying' | 'sitting' | 'standing';
export type SessionPosition = Position | 'moving' | 'mixed';

export type Phase = 'learn' | 'build' | 'maintenance' | 'return_to_build' | 'relax_only' | 'pre_surgery' | 'paused';
export type LearnStatus = 'not_started' | 'in_progress' | 'passed' | 'unconfirmed_proceeding' | 'locked_push_down';

export type Completion = 'complete' | 'partial' | 'stopped_pain';
export type Pain3 = 'no' | 'a_little' | 'yes';
export type Ynu = 'yes' | 'no' | 'unsure';

export type OffTick =
  | 'held_breath'
  | 'pushed_down'
  | 'buttocks_thighs'
  | 'upper_belly'
  | 'could_not_release'
  | 'leak_during_exercise';

export type AudioMode = 'off' | 'tones' | 'voice';

export interface Clock {
  /** Wall-clock time. */
  now(): Date;
  /** Monotonic milliseconds for timers (ARCH-030). */
  monotonic(): number;
}

export const systemClock: Clock = {
  now: () => new Date(),
  monotonic: () =>
    typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now(),
};
