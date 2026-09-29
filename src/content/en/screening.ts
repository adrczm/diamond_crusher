// Safety question and outcome copy (spec 01 §3, §4). Meaning must not change without updating the finding.
import type { QuestionKey } from '../../domain/safety';
import type { Anatomy } from '../../domain/types';

export const SCREENING_INTRO = 'These questions check that exercises are right for you now. They are not a diagnosis.';

const Q: Record<QuestionKey, string | Partial<Record<Anatomy, string>>> = {
  'Q-R1': "Have you seen any blood in your pee (red, pink or brown) that a doctor has not checked?",
  'Q-R2': 'Are you unable to pee at all right now, or only a trickle even though your bladder feels full?',
  'Q-R3': 'Do you have a fever or feel very unwell, with burning or pain when you pee?',
  'Q-R4':
    'In the last few weeks, have you had new numbness or tingling around your genitals, back passage or inner thighs, a new loss of bladder or bowel control, or weakness in both legs, especially with back pain or sciatica?',
  'Q-S1': 'Do you have a urinary catheter in at the moment?',
  'Q-S2': {
    male: 'Have you had prostate, bladder, bowel, genital or pelvic surgery, or pelvic radiotherapy, in the last 3 months?',
    other_unspecified: 'Have you had prostate, bladder, bowel, genital or pelvic surgery, or pelvic radiotherapy, in the last 3 months?',
    female: 'Have you had bladder, bowel, genital or pelvic surgery, or pelvic radiotherapy, in the last 3 months?',
  },
  'Q-S2b': 'Has your surgeon or care team said it is OK to start pelvic floor exercises?',
  'Q-S3': 'Do you have prostate surgery planned?',
  'Q-P1': {
    male: 'Do you have ongoing pain (most days, for weeks or more) in your pelvis, penis, testicles or scrotum, the area between your legs, or your back passage?',
    female: 'Do you have ongoing pain (most days, for weeks or more) in your pelvis, vulva or vagina, the area between your legs, or your back passage?',
    other_unspecified: 'Do you have ongoing pain (most days, for weeks or more) in your pelvis, genitals, the area between your legs, or your back passage?',
  },
  'Q-P2': {
    male: 'Do you get pain when you pee, ejaculate or have sex?',
    female: 'Do you get pain when you pee or have sex?',
    other_unspecified: 'Do you get pain when you pee or have sex?',
  },
  'Q-P3': 'Do you often struggle to start peeing, have a weak or stop-start stream, or need to strain to poo?',
  'Q-P4': 'Did the exercises cause pain during or after?',
  'Q-G1': 'Are your leaks new or getting worse, or do you often have to rush to the toilet or go very often?',
  'Q-G2': 'Is a problem with erections new, or getting worse?',
  'Q-G3': 'Do you leak wind or poo without meaning to?',
  'Q-G4': 'Do you have a known nerve or spinal condition (for example MS, Parkinson\'s, spinal injury, or diabetes with nerve damage)?',
  'Q-G5': 'Squeeze not clearly felt or seen, or it does not let go.',
  'Q-F1': 'Do you feel heaviness, dragging or a bulge in your vagina?',
  'Q-F2': 'Are you pregnant, or have you given birth in the last 3 months?',
  'Q-F3': 'Do you have pain with sex or when inserting a tampon?',
};

export function questionText(key: QuestionKey, anatomy: Anatomy): string {
  const q = Q[key];
  if (typeof q === 'string') return q;
  return q[anatomy] ?? q.male ?? '';
}

/** UX audit M10: "Something changed?" first asks what changed, then only the related safety questions. */
export const CHANGE_TOPICS = {
  question: 'What changed?',
  note: 'Choose all that apply. The app then asks the urgent safety questions and the questions about this change.',
  options: [
    { value: 'pain', label: 'Pain' },
    { value: 'leaks', label: 'Leaks, or how I pee or poo' },
    { value: 'surgery_health', label: 'Surgery or a new health problem' },
    { value: 'other', label: 'Something else, or I am not sure', hint: 'The app asks all the safety questions.' },
  ],
} as const;

export const SURGERY_DATE_PROMPT = 'If you know the date, add it here. You can skip this.';

export const OUTCOME = {
  blocked_urgent: {
    title: 'Get checked today',
    body: 'Get medical help today. Contact a doctor urgently. If you feel very unwell, call emergency services. Do not use this app in place of a medical check. Exercises stay paused until this is checked.',
    reason: 'One of your answers needs a doctor to look at it first.',
  },
  catheter: {
    title: 'Wait until the catheter is out',
    body: 'Do not do pelvic floor exercises while a catheter is in. Exercises unlock when it is out.',
    reason: 'You said that a catheter is in at the moment.',
  },
  surgery: {
    title: 'Wait for the OK from your care team',
    body: 'After surgery, wait until your surgeon or care team says it is OK to start. Exercises unlock when you tell the app that they said OK.',
    reason: 'You said that you had surgery or radiotherapy in the last 3 months.',
  },
  relax_only: {
    title: 'Relaxation practice only for now',
    body: 'Stronger squeezes are not a good idea while you have this pain. See a pelvic health physiotherapist or doctor. They can find the cause. Until then, the app gives relaxation practice only.',
    reason: 'You said that you have pain.',
  },
  caution: {
    title: 'You can start',
    body: 'You can start training. It is a good idea to check some of your answers with a health professional. You can keep training while you do this.',
  },
  normal: {
    title: 'You can start',
    body: 'Nothing in your answers stops you from training.',
  },
} as const;

/** ONB-023 caution cards. Q-G5 copy is owned by 02 (LRN-031). */
/** UX audit C1: a skipped safety question is not a "no". */
export const SKIPPED_NOTE = 'You skipped these safety questions. If one of them is true for you, do not train yet. Talk to a doctor first.';

export const CAUTION_CARD: Record<string, string> = {
  'Q-G1': 'It is a good idea to see a doctor about leaks that are new or worse than before, or a need to rush to the toilet. You can keep training.',
  'Q-G2': 'It is a good idea to see a doctor about an erection problem that is new or worse than before. It can be linked to heart and blood vessel health. You can keep training.',
  'Q-G3': 'It is a good idea to see a doctor if you leak wind or poo. You can keep training.',
  'Q-G4': 'With a nerve or spinal condition, a pelvic health physiotherapist can check your technique. You can keep training.',
  'Q-G5': 'You cannot clearly feel or see the squeeze yet. That is common. A pelvic health physiotherapist can help you find it in one visit.',
  'Q-F1': 'It is a good idea to check this with a health professional. You can keep training.',
  'Q-F2': 'It is a good idea to check this with a health professional. You can keep training.',
};

export const CLEARANCE = {
  urgentTick: 'I have been seen, or this has been checked.',
  painTick: 'A health professional checked me and said that strengthening exercises are OK.',
  clearedButton: 'I am cleared',
  preSurgeryHome: 'Tell the app when your catheter is out and your team says it is OK',
  preSurgeryStartNow: 'It is a good idea to start the programme now, 3 to 4 weeks or more before surgery.',
  preSurgeryShort: 'Your surgery is soon. You can still start now. After surgery, wait for the OK from your care team.',
  stillBlocked: 'Exercises stay paused for now, based on your answers.',
};

export const PAIN_CHOICE = {
  question: 'Is it pain, or just tired muscles?',
  pain: 'Pain',
  tired: 'Just tired',
  tiredReply: 'That is fine. Tired muscles mean it is time to stop the set. The session continues with the next part.',
  mistake: 'Tapped by mistake',
  pausedNote: 'The session is paused.',
  aLittle: 'Go gently. If it is still there next time, the app switches to relaxation only.',
};

export const REVIEW_12W_CARD = 'Not much changed in 3 months. A pelvic health physiotherapist can check what is happening.';

export const RELAX_ONLY_HOME = 'Relaxation practice only, until a health professional checks the pain.';
export const OTHER_PROFILE_PHYSIO = 'A pelvic health physiotherapist can check your technique and tailor training to you. It is a good idea to see one if you can.';
export const TODO_BANNER = 'Some guidance for this profile is not written yet';

/** Words around the safety questions (moved from screen code, DS-P1). */
export const SCREEN_FLOW = {
  dateLabel: 'Date (YYYY-MM-DD)',
  datePlaceholder: '2026-11-30',
  questionOf: (n: number, total: number) => `Question ${n} of ${total}`,
  emergency: 'If you feel very unwell, call emergency services.',
};
