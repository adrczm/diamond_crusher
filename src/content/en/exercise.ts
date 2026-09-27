// Exercise copy (spec 03): block cues, functional habits, add-ons, relax template.
import type { Anatomy, Goal } from '../../domain/types';
import type { RelaxStep } from '../../domain/session/plan';

export const BLOCK_NAME = { relax: 'Relax', hold: 'Hold', flick: 'Quick squeeze', endurance: 'Steady hold' } as const;
export const INTENSITY = {
  relax: 'Let everything soften',
  hold: 'Squeeze hard and lift',
  flick: 'Quick, strong squeeze',
  endurance: 'Half strength, steady',
} as const;

export const PHASE_TEXT = {
  squeeze: 'Squeeze',
  release: 'Let go fully',
  rest: 'Rest',
  transition: 'Get ready',
} as const;

export const VOICE = {
  squeeze: 'Squeeze',
  release: 'Let go',
  rest: 'Rest',
  done: 'Session done',
} as const;

export const RELAX_STEP_TEXT: Record<RelaxStep, { title: string; body: string }> = {
  relax_in: { title: 'Relax', body: 'Take 3 slow breaths. Let your tummy and the area between your legs go soft.' },
  relax_out: { title: 'Relax', body: 'Take 3 slow breaths. Let everything go soft and heavy.' },
  settle: { title: 'Settle', body: 'Lie or sit comfortably. Breathe slowly.' },
  letgo_breath: {
    title: 'Let-go breaths',
    body: 'Breathe in and let your belly and the area between your legs soften and drop. Breathe out and keep letting go.',
  },
  body_release: {
    title: 'Body release',
    body: 'Notice and let go, one part at a time: your jaw, your shoulders, your belly, your buttocks, your pelvic floor.',
  },
  quiet: { title: 'Quiet breathing', body: 'Just breathe quietly. Nothing to do.' },
};

export const SESSION = {
  gettingWeak: 'Getting weak',
  gettingWeakReply: 'Good. Stopping when the squeeze fades is the right call.',
  pain: 'Pain',
  pause: 'Pause',
  resume: 'Resume',
  stop: 'End session',
  skip: 'Skip',
  paused: 'Paused',
  estimated: 'About',
  start: 'Start',
  relaxPractice: 'Relax practice',
  dayDone: "That's today's plan done. More isn't better for these muscles; see you tomorrow.",
  extraStart: 'Start an extra session anyway',
  extraBlocked: "Today's limit for strong holds is reached. Relax practice is still open.",
  somethingChanged: 'Something changed?',
  complete: 'Session complete',
  partial: 'Session saved',
  holdLabel: (rep: number, reps: number) => `Hold ${rep} of ${reps}`,
  flickLabel: (rep: number, reps: number) => `Quick squeeze ${rep} of ${reps}`,
  enduranceLabel: (rep: number, reps: number) => `Steady hold ${rep} of ${reps}`,
  walkingOption: 'Do the steady holds while walking',
  positionName: { lying: 'Lying down', sitting: 'Sitting', standing: 'Standing', moving: 'Walking', mixed: 'Mixed' },
  positionHint: {
    lying: 'Lie on your back, knees bent and apart.',
    sitting: 'Sit upright, feet flat, knees apart.',
    standing: 'Stand with your feet hip-width apart.',
    moving: 'Walk at an easy pace.',
    mixed: '',
  },
};

export const KNACK = {
  title: 'The knack',
  body: "Just before you cough, sneeze, laugh hard or lift something, do a quick, firm squeeze and hold it through the effort. Then let go.",
  practice: 'Practise 3 times: squeeze, pretend to cough, let go.',
  practiceStep: ['Squeeze', 'Cough', 'Let go'],
};

export const AFTER_PEE = {
  title: 'Squeeze after peeing',
  body: "When you've finished peeing, do one firm squeeze to push out the last drops, then let go fully.",
  note: 'Do this after the flow has stopped. It is not stopping the flow.',
};

export function everydaySqueezes(anatomy: Anatomy): string[] {
  const out = [`${KNACK.title}: ${KNACK.body}`];
  if (anatomy === 'male') out.push(`${AFTER_PEE.title}: ${AFTER_PEE.body} ${AFTER_PEE.note}`);
  return out;
}

export interface AddOn {
  goal: Goal;
  title: string;
  items: string[];
  profiles: Anatomy[];
  findingIds: string[];
}

export const ADD_ONS: AddOn[] = [
  {
    goal: 'bladder_control',
    title: 'For bladder control',
    items: ['Use the knack before you cough, sneeze or lift.', 'Squeeze once after peeing to clear the last drops.'],
    profiles: ['male', 'other_unspecified'],
    findingIds: ['B1.5', 'B2.3'],
  },
  {
    goal: 'bladder_control',
    title: 'For bladder control',
    items: ['Use the knack before you cough, sneeze or lift.'],
    profiles: ['female'],
    findingIds: ['B1.5', 'B2.3'],
  },
  {
    goal: 'erection',
    title: 'For erections',
    items: ['During sex, tightening your pelvic floor in a steady rhythm may help keep your erection firm.'],
    profiles: ['male'],
    findingIds: ['B1.5'],
  },
  {
    goal: 'ejaculatory_control',
    title: 'For ejaculatory control',
    items: [
      'When penetration starts, hold a controlled squeeze for about 3 to 10 thrusts, then let go.',
      'Stop-start: when you feel close, stop moving and consciously relax your pelvic floor until the urge passes. Then carry on.',
      'Relaxing, not squeezing, is the key step in stop-start.',
    ],
    profiles: ['male'],
    findingIds: ['B1.5', 'B4.1'],
  },
];

export function addOnsFor(anatomy: Anatomy, goals: Goal[]): AddOn[] {
  return ADD_ONS.filter((a) => a.profiles.includes(anatomy) && goals.includes(a.goal));
}

export const GOAL_LABEL: Record<Anatomy, { goal: Goal; label: string }[]> = {
  male: [
    { goal: 'bladder_control', label: 'Bladder control' },
    { goal: 'ejaculatory_control', label: 'Ejaculatory control' },
    { goal: 'erection', label: 'Erection strength' },
    { goal: 'long_term_health', label: 'Long-term pelvic floor health' },
  ],
  female: [
    { goal: 'bladder_control', label: 'Bladder control' },
    { goal: 'long_term_health', label: 'Long-term pelvic floor health' },
  ],
  other_unspecified: [
    { goal: 'bladder_control', label: 'Bladder control' },
    { goal: 'long_term_health', label: 'Long-term pelvic floor health' },
  ],
};
