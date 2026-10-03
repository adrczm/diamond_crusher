// Learn the squeeze copy (spec 02).
import type { Anatomy } from '../../domain/types';

export interface CueSet {
  keys: string[];
  text: Record<string, string>;
  todo: boolean;
}

/** The facts the cue order reads (from profileFacts). */
export interface CueFacts {
  prostateTreatment?: boolean;
}

export const CUES: Record<Anatomy, CueSet> = {
  // LRN-010, SX-E.22: "testicles up towards your belly" is a second male cue (Greene and Jecketts 2019).
  male: {
    keys: ['cue.male.shorten_penis', 'cue.male.hold_wind', 'cue.male.testicles', 'cue.male.stop_pee'],
    text: {
      'cue.male.shorten_penis': 'Gently draw your penis in, as if shortening it, and lift your testicles.',
      'cue.male.hold_wind': 'Squeeze as if holding in wind.',
      'cue.male.testicles': 'Draw your testicles up towards your belly.',
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
  // LRN-012, SX-C.5: back-passage cue first; stopping the pee is imagined only. No tampon cue.
  female: {
    keys: ['cue.female.hold_wind_lift', 'cue.female.stop_pee'],
    text: {
      'cue.female.hold_wind_lift': 'Squeeze around your back passage as if holding in wind, and lift the entrance to your vagina up and in.',
      'cue.female.stop_pee': 'Imagine stopping your pee midstream.',
    },
    todo: false,
  },
};

/** SX16, SX-E.22: after prostate treatment, "hold in wind" comes first and "shorten the penis" second. */
export function cueKeysFor(anatomy: Anatomy, facts?: CueFacts | null): string[] {
  const keys = CUES[anatomy].keys;
  if (anatomy === 'male' && facts?.prostateTreatment) {
    return ['cue.male.hold_wind', 'cue.male.shorten_penis', ...keys.filter((k) => k !== 'cue.male.hold_wind' && k !== 'cue.male.shorten_penis')];
  }
  return keys;
}

export function cueText(key: string | null, anatomy: Anatomy, facts?: CueFacts | null): string {
  const set = CUES[anatomy];
  return (key && set.text[key]) || set.text[cueKeysFor(anatomy, facts)[0]];
}

/** W1 (approved 2026-10-03): in a session the shorten cue drops "Gently", because holds are strong squeezes. */
const SESSION_CUE_TEXT: Record<string, string> = {
  'cue.male.shorten_penis': 'Draw your penis in, as if shortening it, and lift your testicles.',
};

/** The squeeze prompt in exercise sessions (LRN-014). */
export function sessionCueText(key: string | null, anatomy: Anatomy, facts?: CueFacts | null): string {
  const k = key && CUES[anatomy].text[key] ? key : cueKeysFor(anatomy, facts)[0];
  return SESSION_CUE_TEXT[k] ?? cueText(k, anatomy, facts);
}

/** LRN-015: rotated one per rep. */
export const REMINDER_CUES = ['Keep breathing', 'Buttocks soft', 'Tummy above the belly button soft', 'Lift in. Do not push down.', 'Let it go fully'];

export const LEARN = {
  title: 'Learn the squeeze',
  intro:
    'In studies, between a quarter and a half of people could not squeeze correctly from instructions alone. A pelvic health physiotherapist can check your technique, which is the most reliable way to know. This guide helps you get as close as you can at home.',
  howItWorks: 'You will try the squeeze 3 to 5 times. It takes about 5 minutes.',
  relax: 'Lie on your back, knees bent. Breathe slowly. Let your tummy and the area between your legs go soft.',
  // SX8: in pregnancy, lying exercises are done on the side or propped up.
  relaxPregnant: 'Lie on your side, or sit propped up with pillows. Breathe slowly. Let your tummy and the area between your legs go soft.',
  pregnantDizzy: 'If you feel dizzy or sick lying flat, turn on your side.',
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
  mirrorTitleLying: 'Mirror check',
  mirrorIntroLying: 'Stay lying, propped up on pillows so you can see. You can squeeze again while you check.',
  alsoFingertips: 'Also check with fingertips',
  insideTitle: 'Inside check (optional)',
  addInside: 'Add inside check',
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
  tipLieDownPregnant: 'Try lying on your side, or sit propped up with pillows.',
  physioExam: 'A pelvic health physiotherapist can check your squeeze by examination.',
  tipOtherCheck: 'Try the other self-check.',
  tipTomorrow: 'Try again tomorrow. Muscles learn with practice.',
  recheckTitle: 'Quick technique check',
  recheckIntro: 'One squeeze with a quick check. It takes about a minute.',
};

export const MIRROR_CHECK: Record<Anatomy, { text: string; todo: boolean; note?: string }> = {
  male: {
    text: 'Stand without clothes in front of a mirror. As you squeeze, watch: the base of your penis should pull back slightly and your testicles should lift.',
    todo: false,
  },
  other_unspecified: {
    text: 'Stand or sit with a mirror where you can see the area between your legs. As you squeeze, watch for a lift in and up, not a push down.',
    todo: false,
  },
  // LRN-020 female (SX-C.8): lying propped, the main check. "Widened or bulged" is a push-down sign.
  female: {
    text: 'Lie propped up with your knees bent and apart. Hold a small mirror between your legs. As you squeeze, watch the skin between your vagina and back passage. It should lift up and in, and the entrance to your vagina should pull in. If the entrance widens or bulges, that is a push down.',
    note: 'If you see a bulge at the entrance even when you are relaxed, see a doctor or pelvic health physiotherapist.',
    todo: false,
  },
};
export const MIRROR_ANSWERS = [
  { value: 'yes', label: 'Yes, I saw it' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Unsure' },
] as const;
/** Female mirror answers, stored as yes (lifted), no (widened or bulged) and unsure. */
export const FEMALE_MIRROR_ANSWERS = [
  { value: 'yes', label: 'Lifted in' },
  { value: 'no', label: 'Widened or bulged' },
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
  // LRN-021 female (SX-C.9): a check without putting anything inside.
  female: {
    text: 'Put your fingertips on the skin between your vagina and back passage. As you squeeze, it should lift up and away from your fingers, not bulge down.',
    todo: false,
  },
};
export const TOUCH_ANSWERS = [
  { value: 'lifted', label: 'Lifted' },
  { value: 'bulged', label: 'Bulged down' },
  { value: 'unsure', label: 'Unsure' },
] as const;

/** Optional female inside check (SX-C.10). Hidden with pain with sex or tampons, and in the 6 weeks after birth. */
export const INSIDE_CHECK = {
  text: 'With clean hands, gently put a finger or thumb just inside your vagina. Squeeze. You should feel a gentle squeeze and lift around your finger. Then let go and feel it relax.',
};
export const INSIDE_ANSWERS = [
  { value: 'lifted', label: 'Felt a squeeze and lift' },
  { value: 'pushed', label: 'Felt a push out' },
  { value: 'nothing', label: 'Felt nothing' },
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
