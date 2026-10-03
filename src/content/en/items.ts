// App-own items (spec 06a). Not validated: every screen that shows them carries APP_QUESTION_LABEL (LOG-003).
import type { Anatomy } from '../../domain/types';

export const APP_QUESTION_LABEL = 'App question, not validated';
export const ITEM_SET_VERSION = 1;

export const SESSION_LOG = {
  feelQuestion: 'How did your squeezes feel today?',
  feelOptions: [
    { value: 1, label: 'Very weak' },
    { value: 2, label: 'Weak' },
    { value: 3, label: 'OK' },
    { value: 4, label: 'Strong' },
    { value: 5, label: 'Very strong' },
  ],
  painQuestion: 'Any pain or discomfort during or after the session?',
  painOptions: [
    { value: 'no', label: 'No' },
    { value: 'a_little', label: 'A little' },
    { value: 'yes', label: 'Yes' },
  ],
  offToggle: 'Anything felt off?',
  offQuestion: 'Tick anything that happened today.',
  offOptions: [
    { value: 'held_breath', label: 'Held my breath' },
    { value: 'pushed_down', label: 'Pushed down instead of lifting' },
    { value: 'buttocks_thighs', label: 'Squeezed my buttocks or thighs' },
    { value: 'upper_belly', label: 'Tightened my belly above the belly button' },
    { value: 'could_not_release', label: 'Could not fully let go' },
    { value: 'leak_during_exercise', label: 'Leaked a little during the exercise' },
  ],
  habitQuestion: 'Did you use the knack or after-peeing squeeze today?',
  saved: 'Saved',
  learnLink: 'Some ticks suggest a check of your technique. Do you want to do a quick check?',
} as const;

export const SELF_CHECK = {
  firstTitle: 'First self-check',
  unavailable: 'The self-check is not available while exercises are paused or set to relaxation only.',
  tryAgain: 'Try again',
  startStanding: 'Start standing check',
  seconds: (n: number) => `${n} s`,
  repeatedHow: (h: number, cap: number) => `Hold ${h} s, rest 4 s, up to ${cap} times.`,
  atHold: (label: string, h: number) => `${label} (at ${h} s)`,
  interrupted: 'The timer stopped because the app left the screen. This result is not saved. Do this test again when you are ready.',
  startAgain: 'Start again',
  pacerSqueeze: 'Squeeze',
  pacerLetGo: 'Let go',
  pacerCount: (n: number, of: number) => `${n} of ${of}`,
  title: 'Monthly self-check',
  intro: 'This check has six short steps and takes about 5 minutes. The app compares your numbers only with your own past results.',
  conditionsTitle: 'Before you start',
  conditions: {
    bladder: 'Did you empty your bladder recently?',
    notAfterSession: 'Was your last training session at least an hour ago?',
    samePosition: 'Are you on your back, knees bent (the same position as last time)?',
    samePositionStanding: 'Are you standing, the same as last time?',
  },
  proceedAnyway: 'You can still continue. The app adds a note to the result.',
  rest: 'Rest',
  signTitle: 'Step 1 of 6: Sign check',
  sign: {
    male: 'Squeeze once and watch in a mirror, or rest your fingertips on the skin behind your scrotum. Did the base of your penis pull back slightly and your scrotum lift (or did you feel a lift under your fingers)?',
    female: 'Did your back passage and the entrance to your vagina lift up and inwards?',
    other_unspecified: 'Squeeze once and watch in a mirror, or rest your fingertips on the skin between your genitals and back passage. Did you see or feel a lift in and up?',
  } as Record<Anatomy, string>,
  signOptions: [
    { value: 'yes', label: 'Yes, clearly' },
    { value: 'unsure', label: 'Not sure' },
    { value: 'no', label: 'No' },
  ],
  signMethod: 'How did you check?',
  signMethods: [
    { value: 'mirror', label: 'Mirror' },
    { value: 'touch', label: 'Fingertips' },
  ],
  bulge: 'Did anything bulge or push outward?',
  bulgeOptions: [
    { value: 'no', label: 'No' },
    { value: 'unsure', label: 'Not sure' },
    { value: 'yes', label: 'Yes' },
  ],
  longestTitle: 'Step 2 of 6: Longest strong hold',
  longest: 'Squeeze as strongly as you can and hold. Keep breathing. Tap Stop the moment the squeeze clearly weakens.',
  longestCap: 'That is the maximum for this check. Let go.',
  longestRetry: 'Do you want to try that step once more?',
  start: 'Start',
  stop: 'Stop',
  repeatedTitle: 'Step 3 of 6: Repeated strong holds',
  repeated: 'Tap Faded when a hold clearly weakens or you cannot finish it.',
  faded: 'Faded',
  quickTitle: 'Step 4 of 6: Quick squeezes',
  quick: 'Tap Slowed when the squeezes blur or get slower, or when you cannot let go between them.',
  slowed: 'Slowed',
  techniqueTitle: 'Step 5 of 6: Technique and relax check',
  technique: [
    { key: 'breathing_ok', text: 'Did you keep breathing normally?' },
    { key: 'glutes_belly_relaxed', text: 'Did your buttocks and belly (above the belly button) stay relaxed?' },
    { key: 'full_release', text: 'Could you feel the muscles fully let go after each squeeze?' },
  ],
  techniqueOptions: [
    { value: 'yes', label: 'Yes' },
    { value: 'unsure', label: 'Not sure' },
    { value: 'no', label: 'No' },
  ],
  painTitle: 'Step 6 of 6: Pain',
  pain: 'Any pain during or after this check?',
  painOptions: [
    { value: 'no', label: 'No' },
    { value: 'a_little', label: 'A little' },
    { value: 'yes', label: 'Yes' },
  ],
  resultTitle: 'Your record',
  longestResult: 'Longest strong hold',
  repeatedResult: 'Strong holds in a row',
  quickResult: 'Quick squeezes',
  last: 'last time',
  best: 'best',
  techniqueLink: 'Some answers suggest a check of your technique. Do you want to do Learn the squeeze again?',
  standingNext: 'Your plan now includes standing. Rest for 2 minutes. Then do the same check again, standing.',
  stopEarly: 'Stop here',
} as const;

const EVENTS_KINDS = [
  { value: 'illness', label: 'Ill' },
  { value: 'alcohol', label: 'Drank alcohol' },
  { value: 'new_medication', label: 'New or changed medicine' },
  { value: 'tired_stressed', label: 'Very tired or stressed' },
  { value: 'other', label: 'Other' },
] as const;

export const EVENTS = {
  title: 'Log something',
  leakType: 'Leak or dribble',
  sexType: 'Sexual activity',
  contextType: 'Add a note',
  /** Screen readers: the three log types (a radio group). */
  typeLabel: 'What do you want to log?',
  when: 'When did it happen?',
  whenSex: 'When was this?',
  whichDay: 'Which day?',
  now: 'Now',
  today: 'Today',
  yesterday: 'Yesterday',
  // Day strip (EVT-010): short weekday over the date number. Monday first, as isoWeekday.
  weekdayShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  weekdayLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  monthLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  dayCell: (weekday: string, date: number, month: string) => `${weekday} ${date} ${month}`,
  dayStrip: 'Day',
  // Time-of-day slider (EVT-010): five evenly spaced parts of the day. Labels under the track, words in the readout.
  slider: 'Time of day',
  periods: { morning: 'Morning', noon: 'Noon', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' } as Record<string, string>,
  periodWords: { morning: 'morning', noon: 'noon', afternoon: 'afternoon', evening: 'evening', night: 'night' } as Record<string, string>,
  /** The part of the day "now" is in, picked on purpose: an earlier time in the same part. */
  earlierWords: {
    morning: 'earlier this morning',
    noon: 'around noon',
    afternoon: 'earlier this afternoon',
    evening: 'earlier this evening',
    night: 'earlier tonight',
  } as Record<string, string>,
  readNow: (day: string, time: string) => `${day}, now (${time})`,
  /** After midnight and before 05:00 "now" counts as the night of the day before. */
  readNowLate: (time: string) => `Now (${time}). This counts as last night.`,
  readPeriod: (day: string, part: string) => `${day}, ${part}`,
  recent: 'Recent entries',
  showOlder: 'Show older entries',
  deleteAsk: 'Delete this entry?',
  deleteEntry: (what: string) => `Delete: ${what}`,
  // Q3: an entry in the list opens in the form, to change or delete it.
  editEntry: (what: string) => `Edit: ${what}`,
  editHint: 'Select an entry to change or delete it.',
  editTitle: (what: string) => `Edit entry: ${what}`,
  editOlderDay: (date: string) => `This entry is for ${date}. To move it, pick a day.`,
  noteFallback: 'Note',
  discardTitle: 'Stop this entry?',
  discardBody: 'Your answers on this form are not saved.',
  discard: 'Stop entry',
  situation: 'What were you doing?',
  situations: [
    { value: 'cough_sneeze', label: 'Coughing, sneezing or laughing', profiles: ['male', 'female', 'other_unspecified'] },
    { value: 'lifting', label: 'Lifting or exercise', profiles: ['male', 'female', 'other_unspecified'] },
    { value: 'urge', label: 'A sudden urge to go', profiles: ['male', 'female', 'other_unspecified'] },
    { value: 'after_urinating', label: 'After peeing (dribble)', profiles: ['male'] },
    { value: 'other', label: 'Other', profiles: ['male', 'female', 'other_unspecified'] },
  ],
  amount: 'How much?',
  amounts: [
    { value: 'drops', label: 'A few drops' },
    { value: 'more', label: 'More than a few drops' },
  ],
  activity: 'What kind of activity?',
  activities: [
    { value: 'penetrative_vaginal', label: 'Sex with penetration (vaginal)' },
    { value: 'other_partnered', label: 'Other partnered sex' },
    { value: 'solo', label: 'Solo' },
  ],
  firmness: 'At its firmest, how firm was your erection?',
  firmnessOptions: [
    { value: 0, label: 'Soft, no change' },
    { value: 1, label: 'A little fuller, still soft' },
    { value: 2, label: 'Partly firm' },
    { value: 3, label: 'Firm, but not fully' },
    { value: 4, label: 'Fully firm' },
    { value: null, label: 'Not sure' },
  ],
  time: 'Roughly how long from when penetration (or the main stimulation) started until you ejaculated? Your best guess is fine.',
  timeOptions: [
    { value: 'lt1', label: 'Under 1 minute' },
    { value: '1to2', label: '1 to 2 minutes' },
    { value: '2to3', label: '2 to 3 minutes' },
    { value: '3to5', label: '3 to 5 minutes' },
    { value: '5to10', label: '5 to 10 minutes' },
    { value: '10to20', label: '10 to 20 minutes' },
    { value: '20to30', label: '20 to 30 minutes' },
    { value: 'gt30', label: 'More than 30 minutes' },
    { value: 'no_ejaculation', label: 'Did not ejaculate' },
    { value: 'not_sure', label: 'Not sure' },
  ],
  typeNumber: 'Type a number',
  minutes: 'minutes',
  confirm30: 'Just checking: more than 30 minutes?',
  control: 'How much control did you feel over when you ejaculated?',
  controlEnds: ['No control at all', 'Complete control'],
  bother: 'How much did the timing bother you this time?',
  botherEnds: ['Not at all', 'Very much'],
  saved: 'Saved',
  /** Kinds of notes saved before round 2 (EVT-033 v1). New notes are kind `other` with free text only. */
  contextKinds: EVENTS_KINDS,
  // EVT-033 (round 2): a day note is free text, 280 characters, no kind to pick first. Old notes keep their kind label.
  noteLabel: 'Note about this day',
  noteHint: 'Anything that may explain a good or bad day.',
  noteMax: 280,
  noteCount: (n: number, max: number) => `${n} of ${max} characters`,
  notePlace: 'Your note shows on your progress charts on this day.',
  /** A day note as one line: an old kind label first when there is one, then the text (cut to `max` characters if set). */
  flagText: (kind: string, note: string | null, max = 0) => {
    const label = kind === 'other' ? '' : (EVENTS_KINDS.find((k) => k.value === kind)?.label ?? '');
    const text = typeof note === 'string' ? note.trim() : '';
    const cut = max > 0 && text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
    if (label && cut) return `${label}: ${cut}`;
    return label || cut || 'Note';
  },
  saveKey: 'or press ⌘↵',
  sexualActivityFlag: 'Any sexual activity in the past 4 weeks?',
  sexualActivityOptions: [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'prefer_not', label: 'Prefer not to say' },
  ],
} as const;
