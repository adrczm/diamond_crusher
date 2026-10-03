// Education screens (spec 05 §5). Each carries its finding IDs and the confidence of its claims (CNT-012).
import type { Anatomy, Goal } from '../../domain/types';

export interface EducationScreen {
  id: string;
  title: string;
  body: string[];
  profiles: Anatomy[];
  goals?: Goal[];
  findingIds: string[];
  todo?: boolean;
  diagram?: boolean;
  /** Shown only when the person's facts match (for example after prostate treatment). Hidden without facts. */
  when?: (facts: EducationFacts) => boolean;
}

/** The facts the library reads (from profileFacts). */
export interface EducationFacts {
  prostateTreatment: boolean;
}

export const EDUCATION_FOOTER = 'A training aid, not medical advice.';
const ALL: Anatomy[] = ['male', 'female', 'other_unspecified'];

export const EDUCATION: EducationScreen[] = [
  {
    id: 'ED-01',
    title: 'What is the pelvic floor?',
    profiles: ALL,
    findingIds: ['A1.1'],
    diagram: true,
    body: [
      'Your pelvic floor is a layer of muscles across the bottom of your pelvis. It is shaped like a hammock. It goes from your pubic bone at the front to your tailbone at the back.',
      'These muscles support your bladder and bowel. They help you control pee, poo and wind. They relax when you go to the toilet. They also play a part in sex.',
      'You control these muscles, so you can train them like other muscles. The training teaches two skills: squeeze well, and let go fully.',
    ],
  },
  {
    id: 'ED-02',
    title: 'Your pelvic floor and bladder control',
    profiles: ['male'],
    goals: ['bladder_control'],
    findingIds: ['A1.2', 'B1.5', 'SX-E.16'],
    body: [
      'A ring of muscle goes around the tube that carries pee (urethra), just below the prostate. This muscle does most of the work to hold your pee. Muscles around your back passage and at the base of your penis help it.',
      'Training aims to make these muscles quicker and stronger. This is why the main cue is "draw your penis in". Studies suggest it targets the muscle around the urethra best.',
      'A few drops after peeing is common in men. A firm squeeze after you finish can help clear them.',
      'If the drops come with a weak stream, straining or frequent peeing, get it checked.',
    ],
  },
  {
    id: 'ED-03',
    title: 'Your pelvic floor and erections',
    profiles: ['male'],
    goals: ['erection'],
    findingIds: ['A1.3', 'A3.5'],
    body: [
      'Two muscles at the base of your penis help with erections. One presses on the roots of the erection tissue and briefly raises the pressure inside. The other squeezes the base and helps to keep the blood in.',
      'In one trial, men who trained with a physiotherapist had better erections after 3 months. Training may help you. But no study looked at men without erection problems.',
      'A new erection problem, or one that gets worse, can be an early sign of heart or blood vessel problems. It is a good idea to see a doctor about it.',
    ],
  },
  {
    id: 'ED-04',
    title: 'Your pelvic floor and ejaculation',
    profiles: ['male'],
    goals: ['ejaculatory_control'],
    findingIds: ['A1.4', 'B1.5', 'B3.1'],
    body: [
      'Ejaculation has two stages. First, semen collects inside. Then the muscle at the base of your penis tightens in a rhythm to push it out.',
      'Small studies suggest that learning to control these muscles may help some men last longer. When you feel close, it is as important to relax these muscles as to squeeze them.',
      'The studies were small and used clinic sessions. So the results from training at home may be smaller.',
    ],
  },
  {
    id: 'ED-05',
    title: 'Your pelvic floor',
    profiles: ['female'],
    findingIds: ['A1.5', 'SX-C.13', 'SX-C.15', 'SX-C.17', 'SX-C.19', 'SX-C.22'],
    body: [
      'Your pelvic floor is a sling of muscles across the bottom of your pelvis. It supports your bladder, womb and bowel. Three openings pass through it: the urethra (where pee comes out), the vagina and the back passage.',
      'These muscles help you hold in pee, wind and poo, and relax to let you go. They also play a part in sexual sensation. Pregnancy, giving birth and getting older can stretch or weaken them.',
      'Health guidelines recommend pelvic floor training for women of all ages, and say to keep it up for life. Research in women shows it may help support bladder control, especially leaks when you cough, sneeze or exercise.',
      'Training during pregnancy may help support bladder control in pregnancy and after birth. Small studies suggest it may also help with arousal, orgasm and sexual satisfaction.',
      'Many women squeeze the wrong muscles at first, or push down instead of lifting, and most cannot tell by feel alone. That is why we start by helping you find the squeeze and check it.',
      'In studies, the best results came when a pelvic health physiotherapist checked technique. This app cannot examine you.',
      'If you feel heaviness, dragging or a bulge in your vagina, or have pain with sex, see a doctor or pelvic health physiotherapist.',
    ],
  },
  {
    id: 'ED-06',
    title: 'Why the let-go matters',
    profiles: ALL,
    findingIds: ['A1.6', 'B4.1', 'B4.2'],
    body: [
      "A healthy pelvic floor can squeeze strongly and let go fully. Some people's muscles stay tense instead. This can cause pain, or problems when you pee, poo or have sex.",
      'A stronger squeeze does not help a muscle that is already too tight. So every squeeze in this app ends with a full let-go. Every session starts and ends with slow breaths.',
      'If you feel pain at any time, the app changes to relaxation only. It also suggests that you see a pelvic health physiotherapist.',
    ],
  },
  {
    id: 'ED-07',
    title: 'What to expect, and when',
    profiles: ['male'],
    findingIds: ['B3.1', 'B3.2', 'B3.3', 'C4.2', 'D1.5', 'SX-E.1', 'SX-E.2', 'SX-B.15'],
    body: [
      'Give it 3 months of regular practice. Some things help straight away: a quick squeeze before you cough or lift, and a squeeze after you pee.',
      'Muscles usually take 6 to 12 weeks to get stronger. Studies measured changes in bladder control and sex at about 3 months. Some men continued to improve for up to 6 months.',
      'If you have no symptoms now, your questionnaires will mostly say "all fine". Your progress shows in your own records instead: longer holds and more good squeezes.',
      'After 12 weeks, you move to a lighter routine that keeps your gains. The gains can fade if you stop training completely.',
      'The daily amount, the knack, the long-term routine, the self-check limits, the questionnaire threshold and the app reminders are based mainly on research in women. Studies in men point the same way, but they are fewer.',
      'About the knack: tested mainly in women. In men after prostate surgery, it has not been shown to reduce measured leaks.',
    ],
  },
  {
    id: 'ED-07',
    title: 'What to expect, and when',
    profiles: ['female'],
    findingIds: ['B3.1', 'B3.3', 'C4.2', 'D1.5', 'SX-B.16', 'SX-C.13'],
    body: [
      'Give it 3 months of regular practice. One thing can help straight away: a quick, firm squeeze before you cough, sneeze or lift.',
      'Muscles usually take 6 to 12 weeks to get stronger. Studies in women measured changes in bladder control at about 3 months.',
      'If you have no symptoms now, your questionnaires will mostly say "all fine". Your progress shows in your own records instead: longer holds and more good squeezes.',
      'After 12 weeks, you move to a lighter routine that keeps your gains. The gains can fade if you stop training completely.',
    ],
  },
  {
    id: 'ED-07',
    title: 'What to expect, and when',
    profiles: ['other_unspecified'],
    findingIds: ['B3.1', 'B3.2', 'B3.3', 'C4.2', 'D1.5'],
    body: [
      'Give it 3 months of regular practice. Some things help straight away: a quick squeeze before you cough or lift, and a squeeze after you pee.',
      'Muscles usually take 6 to 12 weeks to get stronger. Studies measured changes in bladder control and sex at about 3 months. Some men continued to improve for up to 6 months.',
      'If you have no symptoms now, your questionnaires will mostly say "all fine". Your progress shows in your own records instead: longer holds and more good squeezes.',
      'After 12 weeks, you move to a lighter routine that keeps your gains. The gains can fade if you stop training completely.',
    ],
  },
  {
    id: 'ED-08',
    title: 'Everyday squeezes',
    profiles: ALL,
    findingIds: ['B2.3', 'B1.5'],
    body: [], // filled from exercise.ts (ENG-040, ENG-041)
  },
  {
    id: 'ED-09',
    title: 'Get the squeeze right',
    profiles: ALL,
    findingIds: ['A2.2', 'A2.4', 'A2.5'],
    body: [
      'Keep breathing while you squeeze. Keep your buttocks, thighs and upper tummy soft.',
      'The squeeze should feel like a lift in and up, never a push down.',
      'Let go fully after every squeeze. You can check your technique again at any time in Settings.',
    ],
  },
  {
    id: 'ED-10',
    title: 'When to get help',
    profiles: ['male', 'other_unspecified'],
    findingIds: ['A3.4', 'A3.5', 'SX-B.6'],
    body: [
      'Get medical help straight away if you have one of these:\n• blood in your pee\n• you cannot pee\n• a fever with pain when you pee\n• new numbness around your genitals or back passage\n• new weakness in your legs',
      'See a doctor soon if you have one of these:\n• leaks that are new or get worse\n• an erection problem that is new\n• pain when you ejaculate\n• a bladder that does not empty well',
      'Get help straight away for black or dark red poo, or bloody diarrhoea.',
      'See a GP soon if you have one of these:\n• blood in your poo or bleeding from your bottom\n• a change in your poo lasting weeks\n• weight loss without trying',
      'Tap "Something changed?" any time to check.',
    ],
  },
  {
    id: 'ED-10',
    title: 'When to get help',
    profiles: ['female'],
    findingIds: ['A3.4', 'SX-A.15', 'SX-A.16', 'SX-A.17', 'SX-B.6'],
    body: [
      'Get medical help straight away for any of these:\n• blood in your pee, not from a period\n• you cannot pee\n• a fever with pain when you pee\n• new numbness around your genitals or back passage\n• new weakness in your legs',
      'See a doctor soon if you have one of these:\n• leaks that are new or get worse\n• heaviness, dragging or a bulge in your vagina\n• pain with sex\n• a bladder that does not empty well',
      'Also see a doctor soon for:\n• bleeding after your periods have stopped for good (after menopause)\n• bleeding between periods, or a change in discharge',
      'Get help straight away for black or dark red poo, or bloody diarrhoea.',
      'See a GP soon if you have one of these:\n• blood in your poo or bleeding from your bottom\n• a change in your poo lasting weeks\n• weight loss without trying',
      'Tap "Something changed?" any time to check.',
    ],
  },
  {
    id: 'ED-11',
    title: 'About the evidence',
    profiles: ['male'],
    findingIds: ['A2.1', 'B3.2', 'D2.2', 'SX-E.1', 'SX-E.2', 'SX-E.8', 'SX-B.15'],
    body: [
      'Pelvic floor training is low risk. Research shows it can help with bladder control in people who already have leaks. Most of that research is in women (incontinence).',
      'For erections, there is one good trial in men with erectile dysfunction, plus smaller studies. For ejaculatory control, the studies of men with premature ejaculation are small.',
      'No study looked at training in men with no symptoms. In the trials that worked, a physiotherapist usually checked the technique. This app cannot check your technique as a physiotherapist can.',
      'The daily amount, the knack, long-term upkeep, the self-check limits, the questionnaire threshold and app reminders are based mainly on research in women.',
      'About the knack: tested mainly in women. In men after prostate surgery, it has not been shown to reduce measured leaks.',
      "Harms have been poorly recorded in men's studies.",
    ],
  },
  {
    id: 'ED-11',
    title: 'About the evidence',
    profiles: ['female'],
    findingIds: ['A2.1', 'SX-C.12', 'SX-C.13', 'SX-C.14', 'SX-C.15', 'SX-C.16', 'SX-C.17', 'SX-C.19', 'SX-C.20'],
    body: [
      'Pelvic floor training is low risk. Health guidelines recommend pelvic floor training for women of all ages, and say to keep it up for life.',
      'Bladder control: research in women shows pelvic floor training may help support bladder control, especially leaks when you cough, sneeze or exercise (stress incontinence). If you mostly get a sudden urge to go, a health professional can also show you bladder training.',
      'Pregnancy and after birth: research shows training in pregnancy may help support bladder control during pregnancy and in the months after birth.',
      'Sexual function: small studies suggest it may help with arousal, orgasm and sexual satisfaction. The certainty is low.',
      'Bowel control: the evidence is unclear. Small studies suggest it may help.',
      'For prolapse, training has been shown to help when a physiotherapist supervises it. This needs an examination first.',
      'In the trials that worked, a physiotherapist usually checked the technique. No home self-check has been tested against an examination. This app cannot check your technique as a physiotherapist can.',
    ],
  },
  {
    id: 'ED-11',
    title: 'About the evidence',
    profiles: ['other_unspecified'],
    findingIds: ['A2.1', 'B3.2', 'D2.2'],
    body: [
      'Pelvic floor training is low risk. Research shows it can help with bladder control in people who already have leaks. Most of that research is in women (incontinence).',
      'For erections, there is one good trial in men with erectile dysfunction, plus smaller studies. For ejaculatory control, the studies of men with premature ejaculation are small.',
      'No study looked at training in men with no symptoms. In the trials that worked, a physiotherapist usually checked the technique. This app cannot check your technique as a physiotherapist can.',
    ],
  },
  {
    id: 'ED-12',
    title: 'Your pelvic floor and bowel control',
    profiles: ALL,
    goals: ['bowel_control'],
    findingIds: ['SX-C.16', 'SX-B.6'],
    body: [
      'The muscles around your back passage help you hold in wind and poo.',
      'The evidence is unclear. Small studies suggest it may help.',
      'Bowel leaks have many causes, so see a GP about them. You can keep training.',
      'Some bowel changes need a quick check. See "When to get help".',
    ],
  },
  {
    id: 'ED-13',
    title: 'Pregnancy and after birth',
    profiles: ['female'],
    goals: ['pregnancy_birth'],
    findingIds: ['SX-C.15', 'SX-A.6', 'SX-A.7', 'SX-A.8'],
    body: [
      'Research shows training in pregnancy may help support bladder control during pregnancy and in the months after birth. Tell your midwife or doctor you are doing pelvic floor training.',
      'In pregnancy, do your lying exercises on your side or propped up with pillows. If you feel dizzy or sick lying flat, turn on your side.',
      'After birth, pelvic floor exercises are encouraged once any catheter is out and you can pee. Gentle squeezes are fine with stitches.',
      'In the first weeks after birth, the squeeze can be hard to feel. That is common. The self-checks help you find it.',
      'If you had a large tear, a forceps or ventouse birth, or a back-to-back baby, ask for a referral to a pelvic health physiotherapist.',
    ],
  },
  {
    id: 'ED-14',
    title: 'Your pelvic floor and sex',
    profiles: ['female'],
    goals: ['sexual_function'],
    findingIds: ['SX-C.17', 'SX-C.18', 'SX-C.21'],
    body: [
      'Small studies suggest pelvic floor training may help with arousal, orgasm and sexual satisfaction, including after birth and after menopause.',
      'Most of these women also had bladder or pelvic floor symptoms. The certainty of the evidence is low.',
      'If sex is painful, do not squeeze harder. Relaxing these muscles comes first. See a doctor or pelvic health physiotherapist.',
    ],
  },
  {
    id: 'ED-15',
    title: 'After prostate treatment',
    profiles: ['male', 'other_unspecified'],
    findingIds: ['SX-E.10', 'SX-E.11', 'SX-E.19'],
    when: (f) => f.prostateTreatment,
    body: [
      'After prostate surgery, training may help bladder control come back sooner. Many men improve over the first year either way.',
      'Leaking at orgasm is common after prostate removal. One small trial found that 3 months of training may help. At 3 months, the difference from men who did not train was not statistically significant.',
      'Bladder changes after radiotherapy can appear months or years later. New leaks, urgency or blood in your pee are worth checking.',
    ],
  },
];

/** Screens for a profile. A screen with a `when` filter shows only when facts are given and match. */
export function educationFor(anatomy: Anatomy, facts?: EducationFacts | null): EducationScreen[] {
  return EDUCATION.filter((e) => e.profiles.includes(anatomy) && (!e.when || (!!facts && e.when(facts))));
}
