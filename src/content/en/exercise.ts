// Exercise copy (spec 03): block cues, functional habits, add-ons, relax template.
import type { Anatomy, Goal } from '../../domain/types';
import type { RelaxStep } from '../../domain/session/plan';

export const BLOCK_NAME = { relax: 'Relax', hold: 'Hold', flick: 'Quick squeeze', endurance: 'Steady hold' } as const;
export const INTENSITY = {
  relax: 'Let everything soften',
  hold: 'Squeeze strongly and lift',
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
  quiet: { title: 'Quiet breathing', body: 'Breathe quietly. You have nothing else to do.' },
};

export const SESSION = {
  gettingWeak: 'Getting weak',
  gettingWeakReply: 'Good call. When the squeeze fades, that is the right time to stop.',
  pain: 'Pain',
  pause: 'Pause',
  resume: 'Resume',
  stop: 'End session',
  skip: 'Skip',
  paused: 'Paused',
  estimated: 'About',
  start: 'Start',
  relaxPractice: 'Relax practice',
  dayDone: "Today's plan is done. More is not better for these muscles. See you tomorrow.",
  extraStart: 'Start extra session',
  extraBlocked: "You reached today's limit for strong holds. Relax practice is still open.",
  somethingChanged: 'Something changed?',
  complete: 'Session complete',
  partial: 'Session saved',
  extraNote: 'Extra session. It does not count toward today’s plan.',
  stepUp: 'Next week, your plan goes up one step.',
  // H3: a tap on End session pauses first and asks.
  endQuestion: 'End session?',
  endNote: 'The app saves the part you did.',
  keepGoing: 'Keep going',
  // H2: the calm summary after a session.
  todayCount: (n: number, total: number) => `Session ${n} of ${total} today`,
  weekCount: (n: number, target: number) => `${n} of ${target} days this week`,
  nextSession: (when: string) => `Next session: ${when}`,
  nextLaterToday: 'Next session: later today',
  nextTomorrow: 'Next session: tomorrow',
  levelLine: (n: number, max: number) => `Level ${n} of ${max}`,
  holdLabel: (rep: number, reps: number) => `Hold ${rep} of ${reps}`,
  flickLabel: (rep: number, reps: number) => `Quick squeeze ${rep} of ${reps}`,
  enduranceLabel: (rep: number, reps: number) => `Steady hold ${rep} of ${reps}`,
  walkingOption: 'Do the steady holds as you walk',
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
  body: 'Just before you cough, sneeze, laugh or lift something, do a quick, firm squeeze. Hold it through the effort. Then let go.',
  practice: 'Practise 3 times: squeeze, pretend to cough, let go.',
  practiceStep: ['Squeeze', 'Cough', 'Let go'],
};

export const AFTER_PEE = {
  title: 'Squeeze after you pee',
  body: 'When you finish peeing, do one firm squeeze to push out the last drops. Then let go fully.',
  note: 'Do this after the flow stops. It does not stop the flow.',
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
    items: ['During sex, squeeze your pelvic floor in a steady rhythm. This may help keep your erection firm.'],
    profiles: ['male'],
    findingIds: ['B1.5'],
  },
  {
    goal: 'ejaculatory_control',
    title: 'For ejaculatory control',
    items: [
      'When penetration starts, hold a controlled squeeze for about 3 to 10 thrusts, then let go.',
      'Stop-start: when you feel close, stop all movement. Relax your pelvic floor on purpose until the urge passes. Then continue.',
      'In stop-start, the key step is to relax, not to squeeze.',
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
