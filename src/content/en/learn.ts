// Learn the squeeze copy (spec 02).
import type { Anatomy } from '../../domain/types';

export interface CueSet {
  keys: string[];
  text: Record<string, string>;
  todo: boolean;
}

export const CUES: Record<Anatomy, CueSet> = {
  male: {
    keys: ['cue.male.shorten_penis', 'cue.male.hold_wind', 'cue.male.stop_pee'],
    text: {
      'cue.male.shorten_penis': 'Gently draw your penis in, as if shortening it, and lift your testicles.',
      'cue.male.hold_wind': 'Squeeze as if holding in wind.',
      'cue.male.stop_pee': 'Imagine stopping your pee midstream.',
    },
    todo: false,
  },
  other_unspecified: {
    keys: ['cue.other.hold_wind_lift', 'cue.other.stop_pee'],
    text: {
      'cue.other.hold_wind_lift': 'Squeeze as if holding in wind, and lift inwards.',
      'cue.other.stop_pee': 'Imagine stopping your pee midstream.',
    },
    todo: false,
  },
  female: {
    keys: ['cue.female.hold_wind_lift', 'cue.female.stop_pee'],
    text: {
      'cue.female.hold_wind_lift': 'Squeeze as if holding in wind, and lift the entrance to your vagina and your back passage up and in.',
      'cue.female.stop_pee': 'Imagine stopping your pee midstream.',
    },
    todo: true,
  },
};

export function cueText(key: string | null, anatomy: Anatomy): string {
  const set = CUES[anatomy];
  return (key && set.text[key]) || set.text[set.keys[0]];
}

/** LRN-015: rotated one per rep. */
export const REMINDER_CUES = ['Keep breathing', 'Buttocks soft', 'Tummy above the belly button soft', 'Lift in. Do not push down.', 'Let it go fully'];

export const LEARN = {
  title: 'Learn the squeeze',
  intro:
    'About half of people squeeze the wrong way at first. A pelvic health physiotherapist can check your technique, which is the most reliable way to know. This guide helps you get as close as you can at home.',
  howItWorks: 'You will try the squeeze 3 to 5 times. It takes about 5 minutes.',
  relax: 'Lie on your back, knees bent. Breathe slowly. Let your tummy and the area between your legs go soft.',
  relaxShort: 'Settle again. Breathe slowly and let everything go soft.',
  cueTitle: 'Your cue',
  anotherCue: 'Try another cue',
  ready: 'Ready',
  squeeze: 'Gently squeeze now. Keep breathing.',
  squeezeAgain: 'Squeeze again',
  letGo: 'Let go fully. Feel it drop back and soften.',
  feltLetGo: 'Did you feel it let go?',
  checkTitle: 'Check the squeeze',
  checkLying: 'Stay lying down. You can squeeze again while you check.',
  useMirror: 'Use a mirror',
  useFingertips: 'Use fingertips',
  mirrorTitle: 'Mirror check (standing)',
  mirrorIntro: 'This check is optional. You do it standing, so your next squeeze is also standing. Tap Squeeze again when you are in position.',
  mistakesTitle: 'Quick checklist',
  offQuestion: 'Anything feel off?',
  offNote: 'For example, you held your breath, used your buttocks or thighs, pushed out, or leaked.',
  breatheSlowly: 'Breathe slowly',
  letGoLabel: 'Let go',
  unsure: 'Unsure',
  attemptOf: (n: number) => `Attempt ${n} of up to 5`,
  notAvailable: 'Learn the squeeze is not available while exercises are paused or set to relaxation only.',
  diagramAlt: 'Diagram of the pelvis. The pelvic floor goes across the bottom like a hammock. During a squeeze, it lifts up and in.',
  diagramCaption: 'A good squeeze lifts the pelvic floor up and in. It does not push down.',
  diagramKey: 'Dashed line: at rest. Solid line: during a squeeze.',
  mistakesNote: 'A slight tightening low in your tummy is normal.',
  resultPass: 'Found it',
  resultPassBody: 'You found the squeeze and let it go fully. Your training can start from your home screen.',
  resultNotSure: 'Not sure yet',
  resultNotSureBody: 'That is common. Try one of these tips.',
  resultPushDown: 'It looks like a push down',
  resultPushDownBody: 'Some signs suggest a push down, not a lift in. Before you train, try again with the tips below.',
  startAnyway: 'Start training anyway',
  startAnywayNote: 'The app asks you to check your technique again once a week.',
  whichCue: 'Which cue worked best?',
  tipAnotherCue: 'Try another cue.',
  tipLieDown: 'Try lying down, knees bent and apart.',
  tipOtherCheck: 'Try the other self-check.',
  tipTomorrow: 'Try again tomorrow. Muscles learn with practice.',
  recheckTitle: 'Quick technique check',
  recheckIntro: 'One squeeze with a quick check. It takes about a minute.',
};

export const MIRROR_CHECK: Record<Anatomy, { text: string; todo: boolean }> = {
  male: {
    text: 'Stand without clothes in front of a mirror. As you squeeze, watch: the base of your penis should pull back slightly and your testicles should lift.',
    todo: false,
  },
  other_unspecified: {
    text: 'Stand or sit with a mirror where you can see the area between your legs. As you squeeze, watch for a lift in and up, not a push down.',
    todo: false,
  },
  female: {
    text: 'Use a hand mirror. As you squeeze, the back passage and vaginal entrance should lift up and inwards. If the entrance widens or bulges, that is a push down.',
    todo: true,
  },
};
export const MIRROR_ANSWERS = [
  { value: 'yes', label: 'Yes, I saw it' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Unsure' },
] as const;

export const TOUCH_CHECK: Record<Anatomy, { text: string; todo: boolean } | null> = {
  male: {
    text: 'Put your fingertips on the skin between your scrotum and back passage. As you squeeze, it should lift up and away from your fingers, not bulge down.',
    todo: false,
  },
  other_unspecified: {
    text: 'Put your fingertips on the skin between your genitals and back passage. As you squeeze, it should lift up and away from your fingers, not bulge down.',
    todo: false,
  },
  female: null,
};
export const TOUCH_ANSWERS = [
  { value: 'lifted', label: 'Lifted' },
  { value: 'bulged', label: 'Bulged down' },
  { value: 'unsure', label: 'Unsure' },
] as const;

export const MISTAKES = [
  { key: 'breathing', question: 'Did you keep breathing?', tip: 'Try again and breathe out slowly as you squeeze.' },
  { key: 'buttocks', question: 'Did your buttocks stay relaxed?', tip: 'Try again and keep your buttocks soft. The squeeze is on the inside.' },
  { key: 'thighs', question: 'Did your thighs stay relaxed and apart?', tip: 'Try again with your knees apart and your thighs loose.' },
  { key: 'tummy', question: 'Did your tummy above the belly button stay soft?', tip: 'Try again and keep your upper tummy loose. Only a small tightening low down is normal.' },
] as const;
export const LIFT_QUESTION = 'Did it feel like a lift in, not a push out?';
export const LIFT_ANSWERS = [
  { value: 'lift', label: 'Lift in' },
  { value: 'push', label: 'Push out' },
  { value: 'unsure', label: 'Unsure' },
] as const;
export const LEAK_QUESTION = 'Any leak of pee or wind?';

/** LRN-040, shown once as information only. It asks no result question: the test happens later (UX audit M9). */
export const STOP_TEST = {
  title: 'One optional test',
  card:
    'Optional, one time only. Next time you pee, try to slow or stop the flow for a second. This lets you feel which muscles do it. Then let it flow and empty fully. Do not do this as an exercise. If you do it regularly, it can upset how your bladder empties.',
};
