// Safety question and outcome copy (spec 01 §3, §4). Meaning must not change without updating the finding.
import type { QuestionKey } from '../../domain/safety';
import type { Anatomy } from '../../domain/types';

export const SCREENING_INTRO = 'These questions check that exercises are right for you now. They are not a diagnosis.';

const Q: Record<QuestionKey, string | Partial<Record<Anatomy, string>>> = {
  'Q-R1': "Have you seen any blood in your pee (red, pink or brown) that a doctor hasn't checked?",
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
  'Q-S2b': "Has your surgeon or care team said it's OK to start pelvic floor exercises?",
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
  'Q-G5': "Squeeze not clearly felt or seen, or it doesn't let go.",
  'Q-F1': 'Do you feel heaviness, dragging or a bulge in your vagina?',
  'Q-F2': 'Are you pregnant, or have you given birth in the last 3 months?',
  'Q-F3': 'Do you have pain with sex or when inserting a tampon?',
};

export function questionText(key: QuestionKey, anatomy: Anatomy): string {
  const q = Q[key];
  if (typeof q === 'string') return q;
  return q[anatomy] ?? q.male ?? '';
}

export const SURGERY_DATE_PROMPT = 'If you know the date, add it here. You can skip this.';

export const OUTCOME = {
  blocked_urgent: {
    title: 'Please get checked today',
    body: "Please get medical help today. Contact a doctor urgently, or call emergency services if you feel very unwell. Don't use this app instead of getting checked. Exercises are paused until this has been looked at.",
    reason: 'One of your answers needs a doctor to look at it first.',
  },
  catheter: {
    title: 'Wait until the catheter is out',
    body: "Don't do pelvic floor exercises while a catheter is in. Exercises will unlock when it's out.",
    reason: 'You told us a catheter is in at the moment.',
  },
  surgery: {
    title: 'Wait for the OK from your care team',
    body: "After surgery, wait until your surgeon or care team says it's OK to start. Exercises will unlock when you confirm they have.",
    reason: 'You told us you had surgery or radiotherapy in the last 3 months.',
  },
  relax_only: {
    title: 'Relaxation practice only for now',
    body: 'Pain like this can mean your pelvic floor is too tense rather than too weak, and squeezing harder could make it worse. Please see a pelvic health physiotherapist or doctor. Until then, the app offers relaxation practice only.',
    reason: 'You told us about pain.',
  },
  caution: {
    title: 'You can start',
    body: 'You can start training. Some of your answers are worth checking with a health professional. You can keep training while you do.',
  },
  normal: {
    title: 'You can start',
    body: 'Nothing in your answers stops you from training.',
  },
} as const;

/** ONB-023 caution cards. Q-G5 copy is owned by 02 (LRN-031). */
export const CAUTION_CARD: Record<string, string> = {
  'Q-G1': 'New or worsening leaks, or rushing to the toilet, are worth checking with a doctor. You can keep training.',
  'Q-G2': 'A new or worsening erection problem is worth checking with a doctor, as it can be linked to heart and blood vessel health. You can keep training.',
  'Q-G3': 'Leaking wind or poo is worth checking with a doctor. You can keep training.',
  'Q-G4': 'With a nerve or spinal condition, a pelvic health physiotherapist can check your technique. You can keep training.',
  'Q-G5': "You haven't been able to clearly feel or see the squeeze yet. That's common. A pelvic health physiotherapist can help you find it in one visit.",
  'Q-F1': 'This is worth checking with a health professional. You can keep training.',
  'Q-F2': 'This is worth checking with a health professional. You can keep training.',
};

export const CLEARANCE = {
  urgentTick: "I've been seen, or this has been checked.",
  painTick: 'A health professional has checked me and said strengthening exercises are OK.',
  clearedButton: "I've been cleared",
  preSurgeryHome: "Tell us when your catheter is out and your team says it's OK",
  preSurgeryStartNow: 'Starting the programme now, 3 to 4 weeks or more before surgery, is a good idea.',
  preSurgeryShort: 'Your surgery is soon. You can still start now. After surgery, wait for the OK from your care team.',
  stillBlocked: 'Exercises stay paused for now, based on your answers.',
};

export const PAIN_CHOICE = {
  question: 'Is it pain, or just tired muscles?',
  pain: 'Pain',
  tired: 'Just tired',
  tiredReply: "That's fine. Tiredness means it's time to stop the set.",
  aLittle: "Go gently. If it's still there next time, we'll switch to relaxation only.",
};

export const REVIEW_12W_CARD = "Nothing much has changed after 3 months. A pelvic health physiotherapist can check what's going on.";

export const RELAX_ONLY_HOME = 'Relaxation practice only, until a health professional has checked the pain.';
export const OTHER_PROFILE_PHYSIO = 'A pelvic health physiotherapist can check your technique and tailor training to you. It’s worth seeing one if you can.';
export const TODO_BANNER = 'Some guidance for this profile is still being written';
