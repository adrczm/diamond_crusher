// First-run step order and the resume point (01 ONB-001; UX audit C2 and H1).

/**
 * The first-run steps in order. profile.onboarding_step holds the index of the step to open on the next start
 * (0 = welcome), so a restart resumes where the person stopped.
 */
export const ONBOARDING_ORDER = ['welcome', 'disclaimer', 'adult', 'anatomy', 'goals', 'age', 'screening', 'outcome', 'finish'] as const;
export type OnboardingStep = (typeof ONBOARDING_ORDER)[number];

/** Steps that count in "Step X of N" (welcome and finish do not). */
export const COUNTED_STEPS: readonly OnboardingStep[] = ['disclaimer', 'adult', 'anatomy', 'goals', 'age', 'screening', 'outcome'];

export function stepIndex(s: OnboardingStep): number {
  return ONBOARDING_ORDER.indexOf(s);
}

/** Where a saved step number resumes. Anything past the end (older builds wrote 9 after the reminder plan) is finish. */
export function resumeStep(saved: number): OnboardingStep {
  if (!Number.isFinite(saved) || saved <= 0) return 'welcome';
  return ONBOARDING_ORDER[Math.min(Math.floor(saved), ONBOARDING_ORDER.length - 1)];
}

/** What is already answered, from the profile, the goals and the safety state. */
export interface OnboardingAnswers {
  disclaimer: boolean;
  adult: boolean;
  anatomy: boolean;
  goals: boolean;
  /** A screening run set the current safety state. */
  screened: boolean;
}

/** The saved step, moved back to the first step whose answer is missing (so no required answer is ever skipped). */
export function resumeAt(saved: number, a: OnboardingAnswers): OnboardingStep {
  const s = resumeStep(saved);
  const past = (x: OnboardingStep) => stepIndex(s) > stepIndex(x);
  if (past('disclaimer') && !a.disclaimer) return 'disclaimer';
  if (past('adult') && !a.adult) return 'adult';
  if (past('anatomy') && !a.anatomy) return 'anatomy';
  if (past('goals') && !a.goals) return 'goals';
  if (past('screening') && !a.screened) return 'screening';
  return s;
}
