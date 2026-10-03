// Safety question and outcome copy (spec 01 §3, §4). Meaning must not change without updating the finding.
import type { QuestionKey } from '../../domain/safety';
import type { Anatomy } from '../../domain/types';

export const SCREENING_INTRO = 'These questions check that exercises are right for you now. They are not a diagnosis.';

const Q: Record<QuestionKey, string | Partial<Record<Anatomy, string>>> = {
  'Q-R1': {
    male: 'Have you seen any blood in your pee (red, pink or brown) that a doctor has not checked?',
    // SX-A.16: a period must not count as blood in the pee.
    female: 'Have you seen any blood in your pee (red, pink or brown), not from a period, that a doctor has not checked?',
    other_unspecified: 'Have you seen any blood in your pee (red, pink or brown), not from a period, that a doctor has not checked?',
  },
  'Q-R2': 'Are you unable to pee at all right now, or only a trickle even though your bladder feels full?',
  'Q-R3': 'Do you have a fever or feel very unwell, with burning or pain when you pee?',
  'Q-R4':
    'In the last few weeks, have you had new numbness or tingling around your genitals, back passage or inner thighs, a new loss of bladder or bowel control, or weakness in both legs, especially with back pain or sciatica?',
  // SX25: NHS bowel cancer symptoms, urgent group.
  'Q-R5': 'Is your poo black or dark red, do you have diarrhoea with blood in it, or is your bottom bleeding without stopping?',
  'Q-S1': 'Do you have a urinary catheter in at the moment?',
  'Q-S2': {
    male: 'Have you had prostate, bladder, bowel, genital or pelvic surgery, or pelvic radiotherapy, in the last 3 months?',
    other_unspecified: 'Have you had prostate, bladder, bowel, genital or pelvic surgery, or pelvic radiotherapy, in the last 3 months?',
    // SX-A.8: a caesarean or a tear repair must not block training. Birth has its own questions (Q-F2b).
    female: 'Apart from giving birth, have you had surgery on your womb, vagina, bladder, bowel or pelvis, or pelvic radiotherapy, in the last 3 months?',
  },
  'Q-S2b': 'Has your surgeon or care team said it is OK to start pelvic floor exercises?',
  // SX-E.12: surgery for an enlarged prostate counts too.
  'Q-S3': 'Do you have prostate surgery planned (including for an enlarged prostate, such as TURP or laser surgery)?',
  'Q-P1': {
    male: 'Do you have ongoing pain (most days, for weeks or more) in your pelvis, penis, testicles or scrotum, the area between your legs, or your back passage?',
    female: 'Do you have ongoing pain (most days, for weeks or more) in your pelvis, vulva or vagina, the area between your legs, or your back passage?',
    other_unspecified: 'Do you have ongoing pain (most days, for weeks or more) in your pelvis, genitals, the area between your legs, or your back passage?',
  },
  'Q-P2': {
    // SX-E.15: a bend or lump in the penis, or painful erections, goes to "see a professional", not to strengthening.
    male: 'Do you get pain when you pee, ejaculate, have sex or have an erection, or do you have a bend or lump in your penis?',
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
  'Q-G6': 'Have you had 2 or more urine infections in the last 6 months?',
  'Q-G7': 'Since your prostate treatment, are your leaks getting worse rather than better?',
  // SX25: NHS bowel cancer symptoms, see-a-GP group (all profiles).
  'Q-B1': 'Have you had blood in your poo, bleeding from your bottom, a change in your poo lasting weeks, or weight loss without trying?',
  'Q-X1': 'Have you ever had radiotherapy to your pelvis, or surgery for a cancer in your pelvis?',
  'Q-M1': 'Have you ever had prostate surgery, or radiotherapy for prostate cancer?',
  'Q-F1': 'Do you feel heaviness, dragging or a bulge in your vagina?',
  'Q-F1b': 'Can you see or feel a bulge at or outside the opening of your vagina?',
  'Q-F1c': 'Do you use a pessary (a support device in your vagina)?',
  'Q-F2': 'Are you pregnant, or have you given birth in the last 3 months?',
  'Q-F2a': 'Are you pregnant?',
  'Q-F2a1': 'Has your maternity team told you to avoid exercise, or to avoid putting anything in your vagina?',
  'Q-F2a2':
    'Do you have bleeding from your vagina, fluid leaking, regular painful tightenings, chest pain, dizziness that does not settle, or a bad headache with blurred vision or swelling?',
  'Q-F2a3': 'Has your mother or sister had bladder leaks, or a bulge in the vagina?',
  'Q-F2b': 'Have you given birth in the last 12 weeks?',
  'Q-F2b1': 'Since the birth, are you unable to pee, or only passing small amounts, or do you feel that your bladder does not empty?',
  'Q-F2b2': 'Did you have a forceps or ventouse birth, or a third- or fourth-degree tear?',
  'Q-F2b3': 'Is your tear or wound more painful, smelly or bleeding?',
  'Q-F3': 'Do you have pain with sex or when inserting a tampon?',
  'Q-F4': 'Did your periods stop more than a year ago, and have you had any bleeding from your vagina since then?',
  'Q-F5': 'Do you have bleeding between periods or after sex, or discharge that has changed colour or smell?',
  'Q-F6': 'Do you leak pee all the time, day and night, without warning?',
  'Q-F7': 'Have you had surgery with vaginal mesh or tape?',
  'Q-F7b': 'Since that surgery, have you had pain, bleeding, discharge, pain or feeling the mesh during sex, repeat infections, or new bladder or bowel problems?',
  'Q-F8': 'Did your periods stop more than a year ago, and do you have vaginal dryness, soreness, or a frequent need to rush to pee?',
  'Q-F9': 'Do you feel bloated on most days (more than 12 days a month)?',
  'Q-F10': 'Do you often struggle to start peeing, have a weak or stop-start stream, or need to strain to poo?',
};

/** Questions that ask for a date after a "yes" (all optional). */
export const DATE_PROMPT: Partial<Record<QuestionKey, string>> = {
  'Q-S3': 'If you know the date, add it here. You can skip this.',
  'Q-F2a': 'If you know your due date, add it here. You can skip this.',
  'Q-F2b': 'Add the date of the birth. The app uses it to know when the after-birth questions stop.',
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
    { value: 'pregnancy', label: 'Pregnancy or birth', female: true },
    { value: 'other', label: 'Something else, or I am not sure', hint: 'The app asks all the safety questions.' },
  ],
} as const;


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
  maternity_urgent: {
    title: 'Get checked today',
    body: 'Contact your maternity unit or midwife now. If you feel very unwell, call emergency services. Exercises stay paused until this is checked.',
    reason: 'One of your answers needs your maternity team to look at it first.',
  },
  maternity_wait: {
    title: 'Check with your maternity team',
    body: 'Check with your maternity team that pelvic floor exercises are OK for you. Exercises unlock when you tell the app that they said OK.',
    reason: 'You said that your maternity team told you to avoid exercise.',
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
  'Q-G6': 'Two or more urine infections in 6 months are worth getting checked by a GP. You can keep training.',
  'Q-G7': 'After prostate treatment, leaks that get worse rather than better are worth checking with your surgical team. You can keep training.',
  'Q-B1': 'These are worth getting checked by a GP soon. You can keep training.',
  'Q-X1':
    'After pelvic radiotherapy or cancer surgery, a specialist pelvic health physiotherapist can tailor training to you. Bladder changes after radiotherapy can come months or years later. New leaks, urgency or blood in your pee are worth checking. You can keep training.',
  'Q-F1': 'This is worth checking with a doctor or pelvic health physiotherapist. Training is often part of what they suggest, and you can keep training.',
  'Q-F1b': 'A bulge at or outside the opening is worth getting checked by a GP soon. You can keep training while you wait.',
  'Q-F1c': 'You can do pelvic floor exercises with your pessary in. Contact your team if you have bleeding, unusual discharge, pain, or you cannot pee.',
  'Q-F2': 'It is a good idea to check this with a health professional. You can keep training.',
  'Q-F2a3': 'When a mother or sister had leaks or a bulge, NICE suggests supervised training from 20 weeks of pregnancy. Ask your midwife about it. You can keep training.',
  'Q-F2b2': 'After a forceps or ventouse birth, or a large tear, ask your midwife, health visitor or GP for a pelvic health physiotherapist. You can keep training.',
  'Q-F2b3': 'See your midwife or GP soon about a tear or wound that is more painful, smelly or bleeding. You can keep training if it does not hurt.',
  'Q-F4': 'Bleeding after the menopause needs a check by a GP, even if it happened only once. You can keep training. This note stays until you book a check.',
  'Q-F5': 'Bleeding between periods or after sex, or a change in discharge, is worth checking with a GP. You can keep training.',
  'Q-F6': 'Leaking all the time is worth getting checked by a GP soon. You can keep training.',
  'Q-F7b': 'These can be signs of a problem with mesh or tape. See your GP or surgical team. You can keep training if it does not hurt.',
  'Q-F8': 'Dryness, soreness or rushing to pee after the menopause is common. A GP or practice nurse can help. You can keep training.',
  'Q-F9': 'Bloating on most days is worth checking with a GP. You can keep training.',
  'Q-F10':
    'Struggling to pee or straining to poo can be a sign of a tense pelvic floor or a bulge. Get it checked by a GP or pelvic health physiotherapist. You can keep training if it does not hurt.',
};

/** Female additions to two shared cards (SX-A.11, SX-A.12, SX7: bladder training comes from a professional). */
const CAUTION_CARD_FEMALE: Record<string, string> = {
  'Q-G1': `${CAUTION_CARD['Q-G1']} If you mostly get a sudden urge to go, a health professional can also show you bladder training.`,
  'Q-G3': 'It is a good idea to see a doctor if you leak wind or poo. After giving birth, tell your midwife, health visitor or GP. This is common and help is available. You can keep training.',
};

export function cautionCardText(key: string, anatomy: Anatomy | null | undefined): string {
  return (anatomy === 'female' && CAUTION_CARD_FEMALE[key]) || CAUTION_CARD[key] || '';
}

export const CLEARANCE = {
  urgentTick: 'I have been seen, or this has been checked.',
  painTick: 'A health professional checked me and said that strengthening exercises are OK.',
  clearedButton: 'I am cleared',
  preSurgeryHome: 'Tell the app when your catheter is out and your team says it is OK',
  preSurgeryStartNow: 'It is a good idea to start the programme now, 3 to 4 weeks or more before surgery.',
  preSurgeryShort: 'Your surgery is soon. You can still start now. After surgery, wait for the OK from your care team.',
  stillBlocked: 'Exercises stay paused for now, based on your answers.',
  maternityTick: 'My maternity team says pelvic floor exercises are OK for me.',
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
