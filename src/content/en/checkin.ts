// Symptom check-in copy (06c PFB-048, 01 ONB-034, 04 PRG-035). Kept out of strings.ts to limit merge conflicts.
// The check-in is an app question, not a validated questionnaire: every screen that shows it carries APP_QUESTION_LABEL.
import { APP_QUESTION_LABEL } from './items';

export const CHECKIN = {
  title: 'Symptom check-in',
  label: APP_QUESTION_LABEL,
  intro: 'A few short questions about how things are now. The safety questions come first. It takes about 2 minutes.',
  why: {
    leaks: 'You logged new leaks, or more leaks than before.',
    erections: 'Your notes show a change in your erections.',
    feel: 'Your squeezes felt weaker than before for 2 weeks in a row.',
    follow_up: 'Your last check-in said that things were worse. This check-in shows if that changed.',
  } as Record<string, string>,
  start: 'Start',
  safetyTitle: 'Safety questions first',
  questionsTitle: 'How things are now',
  questionOf: (n: number, total: number) => `Question ${n} of ${total}`,
  result: {
    savedTitle: 'Answers saved',
    saved: 'Your answers are in Progress, under Questionnaire answers.',
    worseTitle: 'Your plan stays at this level for now',
    worse: 'You said that things are worse than a month ago. Your plan does not step up until a later check-in says the same or better.',
    keepTraining: 'You can keep training.',
    technique: 'A quick technique check is on Today. A wrong squeeze is common, and a check can find it.',
    released: 'Your plan can step up again after a good week.',
    painRoute: 'You said that training causes pain. Follow the advice above.',
  },
  hold: {
    title: 'Your plan is on hold',
    body: (date: string) => `Since ${date}, your plan stays at this level. It steps up again when a check-in says the same or better.`,
    keepTraining: 'You can keep training as usual.',
    lighterTitle: 'Optional: a lighter week',
    lighterBody: 'For 7 days, holds are 1 second shorter, with 2 fewer in each set. Your level does not change.',
    noResearch: 'There is no research on whether easing off helps.',
    lighterButton: 'Lighter week',
    lighterOn: (date: string) => `Lighter week until ${date}. Your level does not change.`,
    checkAgain: 'Check in again',
  },
  escalation: {
    title: 'See a pelvic health physio or doctor',
    body: 'See a pelvic health physio or doctor.',
    repeat: 'Your check-ins said that things are worse two times in a row.',
    week12: 'Things are not better after 12 weeks of your plan.',
    keepTraining: 'They can check what is happening. You can keep training.',
  },
  suggest: {
    title: 'Time for a short check-in',
    body: 'A few questions about how things are now. It takes about 2 minutes.',
    action: 'Start check-in',
  },
  progressRow: 'Symptom check-in',
  progressDetail: 'Answer when something changes',
  /** "Compared with a month ago" answers, as Progress shows them. */
  overall: { 1: 'Better', 2: 'The same', 3: 'Worse' } as Record<number, string>,
};
