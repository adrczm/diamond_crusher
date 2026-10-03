// Profile-specific content (men and women research, 2026-10-03): cue order, session cue, education filters,
// everyday squeezes and add-ons.
import { EDUCATION, educationFor } from '../../src/content/en/education';
import { ADD_ONS, addOnsFor, everydaySqueezes, KNACK, URGE_CONTROL } from '../../src/content/en/exercise';
import { CUES, cueKeysFor, cueText, LEARN, MIRROR_CHECK, sessionCueText, TOUCH_CHECK } from '../../src/content/en/learn';

describe('cues (LRN-010, LRN-012, SX16, W1)', () => {
  it('shows the shorten cue first for most men, with the testicles cue as a second option', () => {
    const keys = cueKeysFor('male', { prostateTreatment: false });
    expect(keys[0]).toBe('cue.male.shorten_penis');
    expect(keys).toContain('cue.male.testicles');
    expect(CUES.male.text['cue.male.testicles']).toBe('Draw your testicles up towards your belly.');
    expect(cueText(null, 'male')).toMatch(/^Gently draw your penis in/);
  });

  it('after prostate treatment, shows "hold in wind" first and the shorten cue second', () => {
    const keys = cueKeysFor('male', { prostateTreatment: true });
    expect(keys.slice(0, 2)).toEqual(['cue.male.hold_wind', 'cue.male.shorten_penis']);
    expect(new Set(keys)).toEqual(new Set(CUES.male.keys));
    expect(cueText(null, 'male', { prostateTreatment: true })).toBe('Squeeze as if holding in wind.');
    expect(cueKeysFor('other_unspecified', { prostateTreatment: true })).toEqual(CUES.other_unspecified.keys);
  });

  it('drops "Gently" from the shorten cue in sessions only (W1)', () => {
    expect(sessionCueText('cue.male.shorten_penis', 'male')).toBe('Draw your penis in, as if shortening it, and lift your testicles.');
    expect(sessionCueText(null, 'male')).toBe('Draw your penis in, as if shortening it, and lift your testicles.');
    expect(cueText('cue.male.shorten_penis', 'male')).toMatch(/^Gently /);
    expect(sessionCueText('cue.male.hold_wind', 'male')).toBe('Squeeze as if holding in wind.');
    expect(sessionCueText(null, 'male', { prostateTreatment: true })).toBe('Squeeze as if holding in wind.');
    expect(sessionCueText(null, 'female')).toBe(CUES.female.text['cue.female.hold_wind_lift']);
  });

  it('has a finished female cue set and self-checks, without the tampon cue', () => {
    expect(CUES.female.todo).toBe(false);
    expect(MIRROR_CHECK.female.todo).toBe(false);
    expect(TOUCH_CHECK.female?.todo).toBe(false);
    expect(CUES.female.text[CUES.female.keys[0]]).toBe(
      'Squeeze around your back passage as if holding in wind, and lift the entrance to your vagina up and in.'
    );
    expect(Object.values(CUES.female.text).join(' ')).not.toMatch(/tampon/i);
    expect(MIRROR_CHECK.female.text).toMatch(/^Lie propped up/);
  });

  it('uses the new error-rate wording in the intro (SX-C.2)', () => {
    expect(LEARN.intro).toMatch(/^In studies, between a quarter and a half of people could not squeeze correctly/);
    expect(LEARN.intro).not.toMatch(/About half/);
  });
});

describe('education filters (05 §5)', () => {
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

  it('hides male-only screens and male wording from the female profile', () => {
    const f = educationFor('female', { prostateTreatment: false });
    for (const id of ['ED-02', 'ED-03', 'ED-04', 'ED-15']) expect(ids(f)).not.toContain(id);
    expect(ids(f)).toEqual(expect.arrayContaining(['ED-05', 'ED-12', 'ED-13', 'ED-14']));
    const text = f.flatMap((e) => e.body).join(' ');
    expect(text).not.toMatch(/erection|ejaculat|some men/i);
    expect(f.every((e) => !e.todo)).toBe(true);
  });

  it('gives each profile one screen per id', () => {
    for (const a of ['male', 'female', 'other_unspecified'] as const) {
      const list = ids(educationFor(a, { prostateTreatment: true }));
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('shows the prostate treatment screen only with that fact', () => {
    expect(ids(educationFor('male'))).not.toContain('ED-15');
    expect(ids(educationFor('male', { prostateTreatment: false }))).not.toContain('ED-15');
    expect(ids(educationFor('male', { prostateTreatment: true }))).toContain('ED-15');
  });

  it('shows the bowel screen to every profile, with its GP line', () => {
    for (const a of ['male', 'female', 'other_unspecified'] as const) expect(ids(educationFor(a))).toContain('ED-12');
    const bowel = EDUCATION.find((e) => e.id === 'ED-12')!;
    expect(bowel.body.join(' ')).toContain('Bowel leaks have many causes, so see a GP about them. You can keep training.');
  });

  it('lists the bowel warning signs for every profile', () => {
    for (const a of ['male', 'female', 'other_unspecified'] as const) {
      const help = educationFor(a).find((e) => e.id === 'ED-10')!.body.join('\n');
      expect(help).toContain('black or dark red poo, or bloody diarrhoea');
      expect(help).toContain('blood in your poo or bleeding from your bottom');
      expect(help).toContain('weight loss without trying');
    }
  });

  it('labels the male evidence that comes mainly from women (items 6, 8, 9)', () => {
    const m = educationFor('male').find((e) => e.id === 'ED-11')!.body.join(' ');
    expect(m).toContain('based mainly on research in women');
    expect(m).toContain('it has not been shown to reduce measured leaks');
    expect(m).toContain("Harms have been poorly recorded in men's studies.");
    const f = educationFor('female').find((e) => e.id === 'ED-11')!.body.join(' ');
    expect(f).toContain('Health guidelines recommend pelvic floor training for women of all ages');
  });
});

describe('everyday squeezes and add-ons (ENG-040, ENG-054, SX4, SX6)', () => {
  it('adds stand up and carry to the female knack with a bulge only', () => {
    expect(everydaySqueezes('female', { bulge: true })[0]).toContain(KNACK.bodyBulge);
    expect(everydaySqueezes('female', { bulge: false })[0]).toContain(KNACK.body);
    expect(everydaySqueezes('female')[0]).toContain(KNACK.body);
    expect(everydaySqueezes('male', { bulge: true })[0]).toContain(KNACK.body);
  });

  it('offers urge control to anyone with urgency', () => {
    for (const a of ['male', 'female', 'other_unspecified'] as const) {
      expect(everydaySqueezes(a, { urgency: true }).some((t) => t.includes(URGE_CONTROL.body))).toBe(true);
      expect(everydaySqueezes(a).some((t) => t.includes(URGE_CONTROL.body))).toBe(false);
    }
    // ENG-042: untimed.
    expect(URGE_CONTROL.body).not.toMatch(/\d/);
  });

  it('gives women no in-sex add-on (ENG-054)', () => {
    const f = addOnsFor('female', ['bladder_control', 'pregnancy_birth', 'sexual_function', 'bowel_control', 'long_term_health']);
    expect(f.flatMap((a) => a.items).join(' ')).not.toMatch(/during sex|penetration|thrust/i);
    expect(addOnsFor('female', ['sexual_function']).flatMap((a) => a.items)).toEqual(['Use the knack before you cough, sneeze or lift.']);
    expect(ADD_ONS.filter((a) => a.profiles.includes('female')).every((a) => a.findingIds.length > 0)).toBe(true);
  });
});
