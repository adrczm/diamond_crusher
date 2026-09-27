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
      "Your pelvic floor is a layer of muscles across the bottom of your pelvis. It's shaped like a hammock, running from your pubic bone at the front to your tailbone at the back.",
      'These muscles hold up your bladder and bowel. They help you hold in pee, poo and wind, and they relax to let you go to the toilet. They also play a part in sex.',
      'You control them, so you can train them like other muscles. Training means two skills: squeezing well and letting go fully.',
    ],
  },
  {
    id: 'ED-02',
    title: 'Your pelvic floor and bladder control',
    profiles: ['male'],
    goals: ['bladder_control'],
    findingIds: ['A1.2', 'B1.5'],
    body: [
      'A ring of muscle around the tube that carries pee (urethra), just below the prostate, does most of the work of holding pee in. Muscles around your back passage and at the base of your penis help it.',
      'Training aims to make these muscles quicker and stronger. That\'s why the main cue is "draw your penis in": studies suggest it targets the muscle around the urethra best.',
      "A few drops after peeing are common. A firm squeeze once you've finished can help clear them.",
    ],
  },
  {
    id: 'ED-03',
    title: 'Your pelvic floor and erections',
    profiles: ['male'],
    goals: ['erection'],
    findingIds: ['A1.3', 'A3.5'],
    body: [
      'Two muscles at the base of your penis help with erections. One presses on the roots of the erection tissue and briefly raises the pressure inside. The other squeezes the base and helps stop blood draining away.',
      "In one trial, men who trained with a physiotherapist had better erections after 3 months. Training may help you, but it hasn't been studied in men without erection problems.",
      "A new or worsening erection problem can be an early sign of heart or blood vessel problems. It's worth seeing a doctor about it.",
    ],
  },
  {
    id: 'ED-04',
    title: 'Your pelvic floor and ejaculation',
    profiles: ['male'],
    goals: ['ejaculatory_control'],
    findingIds: ['A1.4', 'B1.5', 'B3.1'],
    body: [
      'Ejaculation happens in two stages. First, semen gathers inside. Then the muscle at the base of your penis tightens in a rhythm to push it out.',
      'Small studies suggest that learning to control these muscles may help some men last longer. Learning to relax them when you feel close matters as much as squeezing.',
      'The studies were small and used clinic sessions, so results from home training may be smaller.',
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
    title: 'Squeeze and let go: why relaxing matters',
    profiles: ALL,
    findingIds: ['A1.6', 'B4.1', 'B4.2'],
    body: [
      "A healthy pelvic floor can squeeze hard and let go fully. Some people's muscles stay tense instead. That can cause pain, or trouble with peeing, bowels or sex.",
      "Squeezing harder won't help a muscle that's already too tight. So every squeeze in this app ends with a full let-go, and every session starts and ends with slow breaths.",
      'If you ever feel pain, the app switches to relaxation only and suggests seeing a pelvic health physiotherapist.',
    ],
  },
  {
    id: 'ED-07',
    title: 'What to expect, and when',
    profiles: ALL,
    findingIds: ['B3.1', 'B3.2', 'B3.3', 'C4.2', 'D1.5'],
    body: [
      'Give it 3 months of regular practice. Some things help straight away: a quick squeeze before you cough or lift, and a squeeze after you pee.',
      'Muscles usually take 6 to 12 weeks to get stronger. In studies, changes in bladder control and sex were measured at about 3 months, and some men kept improving up to 6 months.',
      'If you have no symptoms now, your questionnaires will mostly say "all fine". Your progress shows in your own records instead: longer holds and more good squeezes.',
      "After 12 weeks you move to a lighter routine to keep what you've built. Gains can fade if you stop completely.",
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
    title: 'Getting the squeeze right',
    profiles: ALL,
    findingIds: ['A2.2', 'A2.4', 'A2.5'],
    body: [
      'Keep breathing while you squeeze. Keep your buttocks, thighs and upper tummy soft.',
      'The squeeze should feel like a lift in and up, never a push down.',
      'Let go fully after every squeeze. You can re-check your technique any time from Settings.',
    ],
  },
  {
    id: 'ED-10',
    title: 'When to get help',
    profiles: ALL,
    findingIds: ['A3.4', 'A3.5'],
    body: [
      "Get medical help straight away if you see blood in your pee, can't pee, have a fever with pain when you pee, or have new numbness around your genitals or back passage or new weakness in your legs.",
      "See a doctor soon if leaks are new or getting worse, if an erection problem is new, if you have pain when you ejaculate, or if your bladder doesn't empty well.",
      'Tap "Something changed?" any time to check.',
    ],
  },
  {
    id: 'ED-11',
    title: 'About the evidence',
    profiles: ALL,
    findingIds: ['A2.1', 'B3.2', 'D2.2'],
    body: [
      'Pelvic floor training is low risk. Research shows it can help with bladder control in people who already have leaks, and most of that research is in women (incontinence).',
      'For erections, there is one good trial in men with erectile dysfunction, plus smaller studies. For ejaculatory control, the studies of men with premature ejaculation are small.',
      "No study has looked at training in men with no symptoms. The trials that worked usually had a physiotherapist checking technique. This app can't check your technique the way a physiotherapist can.",
    ],
  },
];

export function educationFor(anatomy: Anatomy): EducationScreen[] {
  return EDUCATION.filter((e) => e.profiles.includes(anatomy));
}
