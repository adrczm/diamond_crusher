// General UI copy (spec 05: calm, plain, UK English, no guilt, no claims). Screens read copy from here.

export const APP_NAME = 'Diamond Crusher';
export const APP_TAGLINE = 'Pelvic floor training and tracking.';
export const DISCLAIMER_VERSION = 1;
export const DISCLAIMER =
  "Diamond Crusher is a training aid. It guides and tracks pelvic floor exercises as part of a healthy lifestyle. It does not diagnose any condition, and it is not medical advice or a replacement for care from a health professional. If you have pain, leaks, erection problems or any symptom that worries you, see a doctor or a pelvic health physiotherapist. In an emergency, contact emergency services. The app's own questions are not validated tests.";

export const COMMON = {
  continue: 'Continue',
  back: 'Back',
  next: 'Next',
  done: 'Done',
  save: 'Save',
  cancel: 'Cancel',
  skip: 'Skip',
  yes: 'Yes',
  no: 'No',
  close: 'Close',
  notNow: 'Not now',
  edit: 'Edit',
  delete: 'Delete',
  skipQuestion: 'Skip this question',
  finishLater: 'Save and finish later',
  loading: 'One moment…',
};

export const ONBOARDING = {
  welcomeTitle: 'Welcome',
  welcomeBody: 'Pelvic floor training and tracking, private to this phone. No account, and nothing leaves your phone unless you export it.',
  start: 'Start',
  importBackup: 'Import a backup',
  understand: 'I understand',
  adultQuestion: 'Are you 18 or older?',
  notAdult: 'This app is designed for adults. A doctor or pelvic health physiotherapist can advise you.',
  anatomyQuestion: 'Which body are we training?',
  anatomyOptions: [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other_unspecified', label: 'Other or prefer not to say' },
  ],
  anatomyNote: 'This picks the right guidance and checks. The exercises are the same.',
  goalsQuestion: 'What would you like to work on?',
  goalsNote: 'Choose at least one. You can change these later.',
  ageQuestion: 'Your age (optional)',
  ageNote: 'Used only to set how many days a week to train after the first 12 weeks.',
  ageOptions: [
    { value: '18_29', label: '18 to 29' },
    { value: '30_44', label: '30 to 44' },
    { value: '45_59', label: '45 to 59' },
    { value: '60_74', label: '60 to 74' },
    { value: '75_plus', label: '75 or over' },
    { value: null, label: 'Prefer not to say' },
  ],
  screeningTitle: 'A few safety questions',
  lockTitle: 'Lock the app?',
  lockBody: 'You can ask for your fingerprint, face or phone PIN each time the app opens. It is off unless you turn it on. You can change this later in Settings.',
  lockOn: 'Turn on the lock',
  lockOff: 'Leave it off',
  lockUnavailable: 'This phone has no screen lock set up, so the app lock is not available. You can turn it on later in Settings.',
  lockWarning: 'If you add a new fingerprint or face later, the lock may stop working. Keep a backup file so you never lose your data.',
};

export const PLAN = {
  title: 'When will you train?',
  intro: 'Link each session to something you already do each day. It makes the habit easier.',
  sessionsPerDay: 'Sessions a day',
  anchorLabel: 'After…',
  anchors: [
    { key: 'wake', label: 'When I wake up' },
    { key: 'teeth', label: 'After brushing my teeth' },
    { key: 'commute', label: 'On my commute' },
    { key: 'lunch', label: 'At lunch' },
    { key: 'tv', label: 'Evening TV' },
    { key: 'bed', label: 'In bed before sleep' },
    { key: 'custom', label: 'Custom' },
  ],
  customPlaceholder: 'Your own moment (40 characters)',
  time: 'Reminder time',
  days: 'Days',
  planLine: (anchor: string, minutes: number) => `After ${anchor.toLowerCase()}, I'll do my session (about ${minutes} minutes).`,
  permissionWhy: 'Reminders need permission to show notifications. You can change this any time.',
  allowReminders: 'Allow reminders',
  noReminders: 'Carry on without reminders',
  testTitle: 'Test your reminders',
  testBody: 'We will send a test reminder in 10 seconds.',
  sendTest: 'Send a test reminder',
  testQuestion: 'Did you see it?',
  testFixTitle: 'If reminders don’t show',
  testFix: [
    'Allow notifications for Diamond Crusher in your phone settings.',
    'Turn off battery optimisation for the app. Samsung and some other phones can stop reminders without telling you.',
    'Apps in a locked private space can’t show reminders.',
  ],
  openSettings: 'Open phone settings',
  mayBeLate: 'Android may deliver reminders up to about an hour late.',
  reviewOffer: 'Reminders can lose their pull after a few weeks. Want to review your plan or change the wording?',
  reviewPlan: 'Review my plan',
  remindersOff: 'Reminders are off',
  customTextWarning: 'This text may show words on your lock screen that others could read.',
  daysShort: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
};

export const HOME = {
  greeting: (name: string | null) => (name ? `Hello, ${name}` : 'Hello'),
  todayTitle: 'Today',
  sessionOf: (n: number, total: number) => `Session ${n} of ${total}`,
  startSession: 'Start session',
  learnFirst: 'Learn the squeeze',
  relaxPractice: 'Relax practice',
  weekTitle: 'This week',
  weekCount: (done: number, target: number) => `${done} of ${target} days`,
  weekNice: (target: number) => `${target} of ${target}. Nice week.`,
  paused: 'Paused',
  somethingChanged: 'Something changed?',
  logSomething: 'Log something',
  level: (n: number, name: string | null) => (name ? `Level ${n}: ${name}` : `Level ${n}`),
  next: (what: string) => `Next: ${what}`,
  nextCheck: (date: string) => `Next check: ${date}`,
  checkReady: 'Your monthly check is ready',
  reviewReady: 'Your 12-week review is ready',
  shortScreenDue: 'A quick safety re-check is due',
  baselineOffer: 'Do your starting self-check',
  techniqueCheck: 'Quick technique check',
  exportReminder: 'It has been a while since your last backup. Save a backup file?',
  summaryReady: 'Your weekly summary is ready',
  learnHint: 'Start here: learn the squeeze. It takes about 5 minutes.',
  blocked: 'Exercises are paused',
  everyday: 'Everyday squeezes',
  knackCard: 'Taught today: the knack and everyday squeezes',
};

export const NEXT_NAME: Record<string, string> = {
  sitting: 'sitting sessions',
  standing: 'standing sessions',
  endurance: 'steady holds',
  more_standing: 'more standing sessions',
  longer_holds: 'longer holds',
  top: 'keep it steady',
};

export const LEVEL_NAME: Record<string, (after: unknown) => string> = {
  position: (a) => (a === 1 ? 'sitting unlocked' : a === 2 ? 'standing unlocked' : 'more standing'),
  endurance: () => 'steady holds added',
  hold_s: (a) => `${a} s holds`,
  hold_reps: (a) => `${a} holds a session`,
  endurance_hold_s: (a) => `${a} s steady holds`,
};

export const WELCOME_BACK = {
  title: 'Welcome back',
  body: "Welcome back. We'll restart a little easier and build up again.",
  easier: 'Restart a little easier',
  pickUp: 'Pick up where I was',
  reviewPlan: 'Want to review your reminder plan?',
};

export const MAINTENANCE = {
  offerTitle: 'Build phase done',
  offerBody: "Build phase done. From here, a lighter routine keeps what you've built. Your monthly check shows how it's holding.",
  switch: 'Move to the lighter routine',
  keepBuilding: 'Keep building for 4 more weeks',
  targetChanged: (n: number) => `Your weekly target is now ${n} days, to match the lighter routine. You can change it in Settings.`,
  holdingSteady: 'Holding steady',
  topUpTitle: 'A 4-week top-up',
  topUpBody: 'Your record was lower on your last two checks. A 4-week top-up of daily sessions can help build it back.',
  topUpAccept: 'Start the top-up',
  topUpDecline: 'Not now',
  daysToCheck: (n: number) => (n <= 0 ? 'Your monthly check is due' : `${n} days to your monthly check`),
  topOfProgramme: "You're at the top of the programme. Keep it steady.",
};

export const EXPECTATION = 'Most changes take 6 to 12 weeks. Your squeeze before coughing and after peeing can help from today.';

export const MILESTONES: Record<string, string> = {
  first_week: 'First week of training done.',
  first_target_week: 'First week at your target.',
  first_standing: 'First standing session done.',
  pr: 'New personal best in your self-check.',
  level: 'New level reached.',
  build_done: '12-week build complete.',
};

export const PROGRESS = {
  title: 'Progress',
  overviewSymptoms: 'Symptom check-ups',
  noChange: 'No change',
  somethingChanged: 'Something changed',
  noCheckYet: 'No check-up yet',
  trainingWeek: 'Training this week',
  yourRecord: 'Your record',
  trend: { improvement: 'Up', steady: 'Steady', decline: 'Down', too_early: 'Too early to tell' } as Record<string, string>,
  consistency: 'Training consistency',
  consistencySub: 'Days trained each week, and your target.',
  recordChart: 'Your record',
  recordSub: 'From your monthly self-check. Compared only with your own past.',
  lying: 'Lying',
  standing: 'Standing',
  longest: 'Longest strong hold (s)',
  repeated: 'Strong holds in a row',
  quick: 'Quick squeezes',
  hollowNote: 'Hollow points: a condition wasn’t met, or technique was unsure.',
  feel: 'Session feel',
  feelSub: '4-week middle value of how your squeezes felt. Needs 6 logged sessions.',
  leaks: 'Logged leaks',
  leaksSub: 'Leaks you logged (logging is optional, so this may not be every leak).',
  sexual: 'Sexual activity items',
  sexualSub: '4-week middle values. Needs 3 entries in a window.',
  questionnaires: 'Questionnaire answers',
  checkUp: 'check-up',
  checkUpExplain:
    "Your answers show no symptoms right now. That's good news. These questionnaires measure symptoms, so they can't show you getting even better from here. We'll keep asking so you'd notice early if anything changed. Your progress shows up in your training record and monthly self-check instead.",
  table: 'Show as table',
  chart: 'Show as chart',
  noData: 'Nothing to show yet.',
  range: { since_baseline: 'Since start', '12w': '12 weeks', '12m': '12 months' } as Record<string, string>,
  summaries: 'Weekly summaries',
  history: 'History',
  noCheck: 'no check',
  firmness: 'Firmness (0 to 4)',
  control: 'Control (0 to 10)',
  bother: 'Bother (0 to 10)',
};

export const MESSAGES = {
  'PFB-030': 'Early weeks are mostly about learning the movement. Most people need 6 to 12 weeks before their record changes.',
  'PFB-031': (measure: string, from: number, to: number) =>
    `Your ${measure} has gone up on your last two checks: ${from} → ${to}. Your training is showing in your record.`,
  'PFB-031-pb': 'New personal best. Your training is showing in your record.',
  'PFB-033':
    'Your record has held steady. That is common after the first few months. Options: keep going (holding steady is a result too), try a harder position or longer holds, or re-check your technique.',
  'PFB-034': 'Your record is steady. Training more regularly is the most likely way to move it. Want to adjust your reminders or weekly target?',
  'PFB-035': (measure: string, notes: string) =>
    `Your ${measure} was lower on your last two checks. This can happen with illness, tiredness or a busy month.${notes ? ` Notes in that time: ${notes}.` : ''} Check the notes on your chart, and consider a technique refresher.`,
  'PFB-037': (weeks: number) =>
    `After ${weeks} weeks of training, your symptoms look about the same. It's worth having a pelvic health physiotherapist or doctor check things and your technique.`,
  'PFB-045': 'If timing bothers you, a doctor can talk through options.',
  neutral: 'A new week starts now.',
};

export const MEASURE_NAME: Record<string, string> = {
  longest_hold: 'longest strong hold',
  repeated_holds: 'strong holds in a row',
  quick_flicks: 'quick squeezes',
};

export const SUMMARY = {
  title: 'Your week',
  days: (d: number, t: number) => `${d} of ${t} days.`,
  belowTarget: (d: number, t: number) => `${d} of ${t} days. A new week starts now.`,
  sessions: (c: number, p: number) => `${c} of ${p} sessions.`,
  pain: 'You noted discomfort this week, so your plan stays the same for now.',
  progressionSessions:
    'You hit your weekly target. Your plan steps up after a week with at least 2 full sessions on 5 days, so it stays as it is for now.',
  progressionOther: "You hit your weekly target. Your plan stays as it is this week, and that's normal.",
  logged: (leaks: number, sex: number) =>
    `Logged: ${[leaks ? `${leaks} leak${leaks === 1 ? '' : 's'}` : '', sex ? `${sex} sexual activit${sex === 1 ? 'y' : 'ies'}` : ''].filter(Boolean).join(', ')}`,
  next: (d: string) => `Next check: ${d}`,
};

export const BUNDLE = {
  monthlyTitle: 'Monthly check',
  quarterlyTitle: '12-week review',
  expected: (min: number) => `About ${min} minutes. You can do each part separately.`,
  parts: {
    safety: 'Safety re-check',
    sexual_flag: 'Sexual activity',
    questionnaires: 'Questions',
    self_check: 'Self-check',
  } as Record<string, string>,
  partDone: 'Done',
  startPart: 'Start',
  allDone: 'All done for this check.',
  exportOffer: 'Save a backup file now?',
  notYet: 'This check opens 3 days before it is due.',
  recallHeader: (t: string) => t,
  consistencyNote: 'Your log has leaks recorded in the last 4 weeks. Does your answer look right?',
  keep: 'Keep my answers',
  review: 'Review answers',
  rushed: 'Answered quickly',
  resultScore: (name: string, x: number, y: number) => `Your score on ${name}: ${x} of ${y}`,
  unavailable: "This questionnaire can't be shown right now",
  validatedLabel: (name: string) => `Validated questionnaire: ${name}`,
  noValidated: 'Validated questionnaires are added once their licences are in place. For now, the check uses the self-check and the app’s own questions.',
};

export const SETTINGS = {
  title: 'Settings',
  profile: 'Profile',
  nickname: 'Nickname (optional)',
  anatomy: 'Body',
  anatomyChangeNote: 'Changing this re-runs the full safety questions.',
  goals: 'Goals',
  ageBand: 'Age band',
  training: 'Training',
  sessionsPerDay: 'Sessions a day',
  weeklyTarget: 'Weekly target (days)',
  maintenanceTarget: 'Weekly target after 12 weeks',
  weekStart: 'Week starts on',
  sound: 'Sound',
  soundOptions: [
    { value: 'off', label: 'Off' },
    { value: 'tones', label: 'Tones' },
    { value: 'voice', label: 'Voice' },
  ],
  vibration: 'Vibration',
  theme: 'Theme',
  themeOptions: [
    { value: 'system', label: 'Phone setting' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ],
  functionalCues: 'Everyday squeeze tips on home',
  reminders: 'Reminders',
  lockScreen: 'On the lock screen',
  lockScreenOptions: [
    { value: 'private', label: 'Show "Reminder" only' },
    { value: 'secret', label: 'Hide completely' },
  ],
  pause: 'Pause reminders',
  pauseOptions: [
    { days: 1, label: '1 day' },
    { days: 7, label: '1 week' },
    { days: 14, label: '2 weeks' },
    { days: 28, label: '4 weeks' },
    { days: 0, label: 'Until I turn them back on' },
  ],
  resume: 'Turn reminders back on',
  pausedUntil: (d: string) => `Paused until ${d}`,
  pausedIndef: 'Paused',
  knack: 'Daily knack nudge',
  weeklySummaryNote: 'Weekly summary reminder',
  anchorDay: 'Monthly check day',
  security: 'Privacy and security',
  lock: 'App lock',
  lockTimeout: 'Lock again after',
  lockTimeoutOptions: [
    { value: 0, label: 'Right away' },
    { value: 60, label: '1 minute' },
    { value: 300, label: '5 minutes' },
    { value: 900, label: '15 minutes' },
  ],
  data: 'Your data',
  about: 'About',
  learn: 'Learn library',
  relearn: 'Run Learn the squeeze again',
  somethingChanged: 'Something changed?',
  version: (v: string) => `Version ${v}`,
};

export const DATA = {
  title: 'Your data',
  whatTitle: 'What is stored',
  what:
    'Your profile, goals, safety answers, training sessions, logs, self-checks, questionnaire answers, events and settings. Nothing else.',
  whereTitle: 'Where',
  where: 'Only on this phone, in an encrypted database. The key is held in the phone’s secure storage.',
  leavesTitle: 'What leaves the phone',
  leaves: 'Nothing, unless you export a backup file. The app has no internet permission, no account, no ads and no tracking.',
  backupsTitle: 'Phone backups',
  backups: 'The app is excluded from your phone’s cloud and transfer backups. Use a backup file to move to a new phone.',
  lastBackup: (d: string | null) => (d ? `Last backup: ${d}` : 'No backup file saved yet'),
  export: 'Save a backup file',
  import: 'Import a backup file',
  deleteAll: 'Delete all my data',
  exportTitle: 'Save a backup file',
  exportBody: 'Choose a passphrase. You need it to open the file. There is no way to recover it if it is lost.',
  passphrase: 'Passphrase',
  passphraseAgain: 'Type it again',
  passphraseRule: 'At least 12 characters, or 4 words.',
  passphraseMismatch: 'The two passphrases don’t match.',
  strength: { too_short: 'Too short', ok: 'OK', strong: 'Strong' } as Record<string, string>,
  working: 'Protecting your file. This can take up to a minute.',
  exportDone: 'Backup saved. Keep the file and your passphrase safe.',
  importTitle: 'Import a backup file',
  importBody: 'Pick the backup file, then type its passphrase.',
  pickFile: 'Choose file',
  unlockFile: 'Open file',
  previewTitle: 'What’s in the file',
  previewLine: (s: number, c: number, q: number, e: number) => `${s} sessions, ${c} self-checks, ${q} questionnaires, ${e} events`,
  range: (a: string, b: string) => `From ${a} to ${b}`,
  replace: 'Replace',
  replaceNote: 'Everything on this phone is replaced by the file.',
  merge: 'Merge',
  mergeNote: 'Records from both are kept. Choose whose profile and settings to keep:',
  keepPhone: 'This phone',
  keepBackup: 'The backup',
  importDone: 'Import complete.',
  wrongPassphrase: 'Wrong passphrase, or the file is damaged. Nothing was changed.',
  deleteTitle: 'Delete all my data',
  deleteBody: 'This erases everything in the app on this phone and cancels all reminders. It can’t be undone.',
  deleteNote: 'Backup files you saved elsewhere are not deleted.',
  deleteType: 'Type DELETE to confirm',
  deleteWord: 'DELETE',
  deleteButton: 'Delete everything',
  updateNote: 'Before installing an update, save a backup file first.',
};

export const LOCK = {
  title: 'Diamond Crusher is locked',
  unlock: 'Unlock',
  erase: 'Erase app and start over',
  eraseWarning: 'This erases all data in the app. There is no way to get it back without a backup file.',
};

export const UNREADABLE = {
  title: 'Your data can’t be opened',
  body: 'The data on this phone can’t be read, for example after moving to a new phone or a security change.',
  import: 'Import a backup file',
  fresh: 'Start fresh (erases the unreadable data)',
  confirm: 'This erases the unreadable data. Continue?',
  newer: 'This data was made by a newer version. Install the newer version.',
};

export const ABOUT = {
  title: 'About',
  description: APP_TAGLINE,
  licences: 'Questionnaires: the app’s own questions are not validated. Validated questionnaires are added only with the licence holder’s permission.',
  evidence: 'See "About the evidence" in the Learn library.',
};
