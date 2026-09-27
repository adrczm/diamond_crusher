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
    findingIds: ['A1.2', 'B1.5'],
    body: [
      'A ring of muscle goes around the tube that carries pee (urethra), just below the prostate. This muscle does most of the work to hold your pee. Muscles around your back passage and at the base of your penis help it.',
      'Training aims to make these muscles quicker and stronger. This is why the main cue is "draw your penis in". Studies suggest it targets the muscle around the urethra best.',
      'A few drops after you pee are common. A firm squeeze after you finish can help clear them.',
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
    findingIds: ['A1.5'],
    todo: true,
    body: [
      'Your pelvic floor supports your bladder, womb and bowel. Three openings pass through it: the urethra, the vagina and the back passage.',
      'Pregnancy, birth and age can stretch it. Training may help support bladder control and pelvic floor fitness.',
      'If you feel heaviness or a bulge in your vagina, see a health professional.',
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
    profiles: ALL,
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
    profiles: ALL,
    findingIds: ['A3.4', 'A3.5'],
    body: [
      'Get medical help straight away if you have one of these:\n• blood in your pee\n• you cannot pee\n• a fever with pain when you pee\n• new numbness around your genitals or back passage\n• new weakness in your legs',
      'See a doctor soon if you have one of these:\n• leaks that are new or get worse\n• an erection problem that is new\n• pain when you ejaculate\n• a bladder that does not empty well',
      'Tap "Something changed?" any time to check.',
    ],
  },
  {
    id: 'ED-11',
    title: 'About the evidence',
    profiles: ALL,
    findingIds: ['A2.1', 'B3.2', 'D2.2'],
    body: [
      'Pelvic floor training is low risk. Research shows it can help with bladder control in people who already have leaks. Most of that research is in women (incontinence).',
      'For erections, there is one good trial in men with erectile dysfunction, plus smaller studies. For ejaculatory control, the studies of men with premature ejaculation are small.',
      'No study looked at training in men with no symptoms. In the trials that worked, a physiotherapist usually checked the technique. This app cannot check your technique as a physiotherapist can.',
    ],
  },
];

export function educationFor(anatomy: Anatomy): EducationScreen[] {
  return EDUCATION.filter((e) => e.profiles.includes(anatomy));
}
