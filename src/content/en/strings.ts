// General UI copy (spec 05: calm, plain, UK English, no guilt, no claims; STE and voice rules in research/ux-writing/style-guide.md). Screens read copy from here.

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
  finishLater: 'Save for later',
  loading: 'One moment…',
};

export const ONBOARDING = {
  welcomeTitle: 'Welcome',
  welcomeBody: 'Pelvic floor training and tracking that stays on this phone. No account. Nothing leaves the phone unless you export it.',
  start: 'Start',
  importBackup: 'Import a backup',
  understand: 'I understand',
  adultQuestion: 'Are you 18 or older?',
  notAdult: 'This app is for adults only. A doctor or a pelvic health physiotherapist can give you advice.',
  anatomyQuestion: 'Which body is this plan for?',
  anatomyOptions: [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other_unspecified', label: 'Other or prefer not to say' },
  ],
  anatomyNote: 'Your answer sets the right guidance and checks. The exercises stay the same.',
  goalsQuestion: 'What do you want to train for?',
  goalsNote: 'Choose at least one. You can change these later.',
  ageQuestion: 'Your age (optional)',
  ageNote: 'The app uses this only to set how many days a week you train after week 12.',
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
  lockBody: 'The app can ask for your fingerprint, face or phone PIN each time it opens. The lock is off by default. You can change this in Settings at any time.',
  lockOn: 'Use the lock',
  lockOff: 'Skip the lock',
  lockUnavailable: 'This phone has no screen lock, so the app lock is not available. After you add a screen lock, you can use the app lock from Settings.',
  lockWarning: 'If you add a new fingerprint or face later, the lock may stop working. Keep a backup file so that you do not lose your data.',
};

export const PLAN = {
  title: 'When will you train?',
  intro: 'Link each session to something you already do each day. The habit is then easier to keep.',
  sessionsPerDay: 'Sessions a day',
  anchorLabel: 'After…',
  anchors: [
    { key: 'wake', label: 'When I wake' },
    { key: 'teeth', label: 'After I brush my teeth' },
    { key: 'commute', label: 'On my commute' },
    { key: 'lunch', label: 'At lunch' },
    { key: 'tv', label: 'During evening TV' },
    { key: 'bed', label: 'In bed before sleep' },
    { key: 'custom', label: 'Custom' },
  ],
  customPlaceholder: 'Your own moment (40 characters or fewer)',
  time: 'Reminder time',
  days: 'Days',
  // H9: the real session length changes with the level, so the plan does not promise a number of minutes.
  planLine: (anchor: string, _minutes?: number) => `${anchor.charAt(0).toUpperCase()}${anchor.slice(1)}, I will do my session (a few minutes).`,
  permissionWhy: 'Reminders need permission to show notifications. You can change this at any time.',
  allowReminders: 'Allow reminders',
  noReminders: 'Skip reminders',
  testTitle: 'Test your reminders',
  testBody: 'The test reminder arrives 10 seconds after you tap.',
  sendTest: 'Send a test',
  testQuestion: 'Did you see it?',
  testFixTitle: 'If reminders do not show',
  testFix: [
    'Allow notifications for Diamond Crusher in your phone settings.',
    'Remove the app from battery optimisation. Samsung and some other phones can stop reminders and not tell you.',
    'Apps in a locked private space cannot show reminders.',
  ],
  openSettings: 'Open phone settings',
  mayBeLate: 'Android may deliver reminders up to about an hour late.',
  reviewOffer: 'Reminders can lose their pull after a few weeks. Do you want to review your plan or the reminder text?',
  reviewPlan: 'Review my plan',
  remindersOff: 'Reminders are off',
  customTextWarning: 'This text can show on your lock screen, where other people can read it.',
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
  /** Day letters for the week dots, Monday first (ISO weekday − 1). */
  dayLetters: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  dayNames: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  todayMark: 'today',
  dayTrained: 'trained',
  dayNotTrained: 'no training',
  weekNice: (target: number) => `${target} of ${target}. Nice week.`,
  paused: 'Paused',
  somethingChanged: 'Something changed?',
  logSomething: 'Log something',
  level: (n: number, name: string | null, max?: number | null) => `Level ${n}${max ? ` of ${max}` : ''}${name ? `: ${name}` : ''}`,
  next: (what: string) => `Next: ${what}`,
  nextAfter: (what: string, weeks: number) => `Next: ${what}, after ${weeks} more good ${weeks === 1 ? 'week' : 'weeks'}`,
  goodWeek: (sessions: number) => `A good week is 5 days with ${sessions} full ${sessions === 1 ? 'session' : 'sessions'} or more, and no pain.`,
  nextReminder: (when: string) => `Next reminder: ${when}`,
  whenToday: (time: string) => `today at ${time}`,
  whenTomorrow: (time: string) => `tomorrow at ${time}`,
  whenDay: (day: string, time: string) => `${day} at ${time}`,
  sessionContents: 'Today’s session',
  nextCheck: (date: string) => `Next check: ${date}`,
  checkReady: 'Your monthly check is ready',
  reviewReady: 'Your 12-week review is ready',
  shortScreenDue: 'A quick safety re-check is due',
  baselineOffer: 'Do your starting self-check',
  techniqueCheck: 'Quick technique check',
  exportReminder: 'Your last backup was some time ago. Save a new backup file?',
  summaryReady: 'Your weekly summary is ready',
  learnHint: 'Start here: learn the squeeze. It takes about 5 minutes.',
  blocked: 'Exercises are paused',
  everyday: 'Everyday squeezes',
  knackCard: 'New today: the knack and everyday squeezes',
};

/** C2: setup that onboarding no longer asks for, offered on Today after the first full session. */
export const SETUP = {
  plan: { title: 'Pick your training times', body: 'Link each session to something you do each day. The app can then remind you.', action: 'Choose times' },
  expect: { title: 'What to expect', body: 'Read how long changes usually take, and what is normal on the way.', action: 'Read it' },
  lock: { title: 'Lock the app', body: 'The app can ask for your fingerprint, face or phone PIN each time it opens.', action: 'Open settings' },
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
  body: 'Welcome back. We will restart a little easier and build again.',
  easier: 'Restart easier',
  pickUp: 'Continue my plan',
  reviewPlan: 'Do you want to review your reminders?',
};

export const MAINTENANCE = {
  offerTitle: 'Build phase done',
  offerBody: 'That is 12 weeks of training. From now on, a lighter routine keeps what you built. Your monthly check shows how it holds. Or you can build for 4 more weeks.',
  switch: 'Start lighter routine',
  keepBuilding: 'Add 4 weeks',
  targetChanged: (n: number) => `Your weekly target is now ${n} days, to match the lighter routine. You can change it in Settings.`,
  holdingSteady: 'Holding steady',
  topUpTitle: 'A 4-week top-up',
  topUpBody: 'Your record was lower on your last two checks. A 4-week top-up of daily sessions can help it grow again.',
  topUpAccept: 'Start the top-up',
  topUpDecline: 'Not now',
  daysToCheck: (n: number) => (n <= 0 ? 'Your monthly check is due' : `${n} days to your monthly check`),
  topOfProgramme: 'Top of the programme. From here, steady is the goal.',
};

export const EXPECTATION = 'Most changes take 6 to 12 weeks. A squeeze before you cough and after you pee can help from today.';

export const MILESTONES: Record<string, string> = {
  first_week: 'First week of training done.',
  first_target_week: 'First full week at your target. Nice.',
  first_standing: 'First standing session done.',
  pr: 'New personal best in your self-check.',
  level: 'You reached a new level.',
  build_done: '12-week build done. That is a real habit.',
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
  recordSub: 'From your monthly self-check. It compares you only with your own past results.',
  lying: 'Lying',
  standing: 'Standing',
  longest: 'Longest strong hold (s)',
  repeated: 'Strong holds in a row',
  quick: 'Quick squeezes',
  hollowNote: 'Hollow points: one condition of the check was missing, or you were not sure of your technique.',
  feel: 'Session feel',
  feelSub: 'The 4-week middle value of how your squeezes felt. It needs 6 logged sessions.',
  leaks: 'Logged leaks',
  leaksSub: 'Leaks you logged. Logging is optional, so this may not show every leak.',
  sexual: 'Sexual activity items',
  sexualSub: '4-week middle values. It needs 3 entries in a window.',
  questionnaires: 'Questionnaire answers',
  checkUp: 'check-up',
  checkUpExplain:
    'Your answers show no symptoms now. That is good news. These questionnaires measure symptoms, so they cannot show more progress from here. We will continue to ask, so that you see any change early. Your progress shows in your training record and monthly self-check instead.',
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
    `Your ${measure} went up on your last two checks: ${from} → ${to}. Your training shows in your record.`,
  'PFB-031-pb': 'New personal best. Your training shows in your record.',
  'PFB-033':
    'Your record stayed steady. That is common after the first few months. You can continue as you are (steady is a result too), try a more difficult position or longer holds, or re-check your technique.',
  'PFB-034': 'Your record is steady. More regular training is the most likely way to move it. Do you want to change your reminders or weekly target?',
  'PFB-035': (measure: string, notes: string) =>
    `Your ${measure} was lower on your last two checks. This can happen with illness, tiredness or a busy month.${notes ? ` Notes in that time: ${notes}.` : ''} Check the notes on your chart. Then think about a technique refresher.`,
  'PFB-037': (weeks: number) =>
    `After ${weeks} weeks of training, your symptoms look about the same. It is a good idea to have a pelvic health physiotherapist or doctor check things and your technique.`,
  'PFB-045': 'If timing bothers you, a doctor can discuss the options with you.',
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
    'Weekly target done. Your plan goes to the next level after a week with at least 2 full sessions on 5 days. For now, it stays the same.',
  progressionOther: 'Weekly target done. Your plan stays the same this week. That is normal.',
  logged: (leaks: number, sex: number) =>
    `Logged: ${[leaks ? `${leaks} leak${leaks === 1 ? '' : 's'}` : '', sex ? `${sex} sexual activit${sex === 1 ? 'y' : 'ies'}` : ''].filter(Boolean).join(', ')}`,
  next: (d: string) => `Next check: ${d}`,
};

export const BUNDLE = {
  monthlyTitle: 'Monthly check',
  quarterlyTitle: '12-week review',
  expected: (min: number) => `About ${min} minutes. You can do each part at a different time.`,
  parts: {
    safety: 'Safety re-check',
    sexual_flag: 'Sexual activity',
    questionnaires: 'Questions',
    self_check: 'Self-check',
  } as Record<string, string>,
  partDone: 'Done',
  startPart: 'Start',
  allDone: 'Check done. See you next time.',
  exportOffer: 'Save a backup file now?',
  notYet: 'This check opens 3 days before it is due.',
  recallHeader: (t: string) => t,
  consistencyNote: 'You logged leaks in the last 4 weeks. Does your answer look right?',
  keep: 'Keep my answers',
  review: 'Review answers',
  rushed: 'Answered quickly',
  resultScore: (name: string, x: number, y: number) => `Your score on ${name}: ${x} of ${y}`,
  unavailable: 'This questionnaire is not available now',
  validatedLabel: (name: string) => `Validated questionnaire: ${name}`,
  noValidated: 'The app adds validated questionnaires when their licences are in place. Until then, the check uses the self-check and the app’s own questions.',
};

export const SETTINGS = {
  title: 'Settings',
  profile: 'Profile',
  nickname: 'Nickname (optional)',
  anatomy: 'Body',
  anatomyChangeNote: 'If you change this, the app asks all the safety questions again.',
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
  functionalCues: 'Everyday squeeze tips on the home screen',
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
    { days: 0, label: 'Until I start them again' },
  ],
  resume: 'Restart reminders',
  pausedUntil: (d: string) => `Paused until ${d}`,
  pausedIndef: 'Paused',
  knack: 'Daily knack nudge',
  weeklySummaryNote: 'Weekly summary reminder',
  anchorDay: 'Monthly check day',
  security: 'Privacy and security',
  lock: 'App lock',
  lockTimeout: 'Lock again after',
  lockTimeoutOptions: [
    { value: 0, label: 'Immediately' },
    { value: 60, label: '1 minute' },
    { value: 300, label: '5 minutes' },
    { value: 900, label: '15 minutes' },
  ],
  data: 'Your data',
  about: 'About',
  learn: 'Learn library',
  relearn: 'Repeat Learn the squeeze',
  somethingChanged: 'Something changed?',
  version: (v: string) => `Version ${v}`,
};

export const DATA = {
  title: 'Your data',
  whatTitle: 'What the app keeps',
  what:
    'Your profile, goals, safety answers, training sessions, logs, self-checks, questionnaire answers, events and settings. Nothing else.',
  whereTitle: 'Where it is',
  where: 'The app keeps your data only on this phone, in an encrypted database. The phone’s secure storage holds the key.',
  leavesTitle: 'What leaves the phone',
  leaves: 'Nothing, unless you export a backup file or sync by code with your other device. The app has no internet permission, no account, no ads and no tracking.',
  backupsTitle: 'Phone backups',
  backups: 'Your phone’s cloud and transfer backups do not include the app. Use a backup file to move to a new phone.',
  lastBackup: (d: string | null) => (d ? `Last backup: ${d}` : 'No backup file yet'),
  export: 'Save a backup',
  import: 'Import a backup',
  deleteAll: 'Delete all my data',
  exportTitle: 'Save a backup file',
  exportBody: 'Choose a passphrase. You need it to open the file. If you lose it, there is no way to recover it.',
  passphrase: 'Passphrase',
  passphraseAgain: 'Type it again',
  passphraseRule: 'At least 12 characters, or 4 words.',
  passphraseMismatch: 'The two passphrases are different. Type them again.',
  strength: { too_short: 'Too short', ok: 'OK', strong: 'Strong' } as Record<string, string>,
  working: 'The app now encrypts your file. This can take up to 1 minute.',
  exportDone: 'Backup saved. Keep the file and your passphrase safe.',
  importTitle: 'Import a backup file',
  importBody: 'Choose the backup file. Then type its passphrase.',
  pickFile: 'Choose file',
  unlockFile: 'Open file',
  previewTitle: 'What is in the file',
  previewLine: (s: number, c: number, q: number, e: number) => `${s} sessions, ${c} self-checks, ${q} questionnaires, ${e} events`,
  range: (a: string, b: string) => `From ${a} to ${b}`,
  replace: 'Replace',
  replaceNote: 'The file replaces everything on this phone.',
  merge: 'Merge',
  mergeNote: 'The app keeps the records from both. Choose which profile and settings to keep:',
  keepPhone: 'This phone',
  keepBackup: 'The backup',
  importDone: 'Import done. Your records are all here.',
  wrongPassphrase: 'The passphrase is wrong, or the file is damaged. Nothing changed. Type the passphrase again.',
  deleteTitle: 'Delete all my data',
  deleteBody: 'This erases all app data on this phone and cancels all reminders. You cannot undo this.',
  deleteNote: 'This does not delete backup files that you saved in other places.',
  deleteType: 'Type DELETE to continue',
  deleteWord: 'DELETE',
  deleteButton: 'Delete everything',
  updateNote: 'Save a backup file before you install an update.',
};

export const LOCK = {
  title: 'Diamond Crusher is locked',
  unlock: 'Unlock',
  erase: 'Erase and restart',
  eraseWarning: 'This erases all data in the app. Without a backup file, you cannot recover it.',
};

export const UNREADABLE = {
  title: 'The app cannot open your data',
  body: 'The app cannot read the data on this phone. This can happen after a move to a new phone or a security change.',
  import: 'Import a backup',
  fresh: 'Erase and restart',
  confirm: 'This erases the unreadable data. Continue?',
  newer: 'A newer version of the app made this data. Install the newer version.',
};

export const ABOUT = {
  title: 'About',
  description: APP_TAGLINE,
  licences: 'Questionnaires: the app’s own questions are not validated. The app adds validated questionnaires only with permission from the licence holder.',
  evidence: 'See "About the evidence" in the Learn library.',
};

/** Desktop layout (Mac): sidebar, toolbar and keyboard shortcuts. */
export const DESKTOP = {
  nav: {
    home: 'Today',
    progress: 'Progress',
    log: 'Log',
    check: 'Check-ins',
    library: 'Learn library',
    reminders: 'Reminders',
    settings: 'Settings',
    data: 'Backup and data',
  },
  navGroups: { train: 'Train', track: 'Track', app: 'App' },
  start: 'Start session',
  todayDone: 'Done for today',
  back: 'Back',
  close: 'Close',
  theme: 'Appearance',
  themeShort: { system: 'Auto', light: 'Light', dark: 'Dark' } as Record<string, string>,
  shortcutsHint: 'Press ? for keyboard shortcuts',
  shortcutsTitle: 'Keyboard shortcuts',
  shortcuts: [
    { keys: 'S', what: 'Start today’s session' },
    { keys: '1 to 8', what: 'Go to a section in the sidebar' },
    { keys: 'T', what: 'Switch light, dark or automatic appearance' },
    { keys: 'Space', what: 'Pause or resume a running session' },
    { keys: 'Esc', what: 'Go back or close this panel. In a session, pause, then end.' },
    { keys: '?', what: 'Show these shortcuts' },
  ],
  sessionKeys: 'Space pauses · Esc twice ends',
  shortcutsToggle: 'Use single-key shortcuts',
  shortcutsToggleHint: 'If you use speech input or other assistive tools, set this to off.',
  startKey: 'or press S',
  articles: 'Articles',
  settingsNotes: {
    profile: 'Used to choose your exercises and wording. It stays on this device.',
    training: 'How often you train, and how sessions sound and feel.',
    appearance: 'Light, dark, or match the device. Both themes are easy to read.',
    security: 'Who can open the app, and your data.',
    more: 'Learning, re-checks and version details.',
  },
  more: 'More',
  sessionProgress: (pct: number) => `${pct}% of this session done`,
};
