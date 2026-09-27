// Content checks (05 CNT-004, CNT-011, CNT-040; 08 MOT-020, REM-021; 02 LRN-013).
import * as fs from 'fs';
import * as path from 'path';
import * as education from '../../src/content/en/education';
import * as exercise from '../../src/content/en/exercise';
import * as items from '../../src/content/en/items';
import * as learn from '../../src/content/en/learn';
import * as screening from '../../src/content/en/screening';
import * as strings from '../../src/content/en/strings';
import * as reminders from '../../src/domain/reminders';
import { MODULES } from '../../src/content/en/questionnaires';

/** Every string reachable from a value; functions are called with sample arguments. */
function collect(v: unknown, out: string[] = [], seen = new Set<unknown>()): string[] {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') {
    try {
      collect((v as (...a: unknown[]) => unknown)(3, 5, 7, 9), out, seen);
      collect((v as (...a: unknown[]) => unknown)('Sample', 'sample notes'), out, seen);
    } catch {
      // Not a copy function.
    }
  } else if (v && typeof v === 'object' && !seen.has(v)) {
    seen.add(v);
    for (const x of Object.values(v as Record<string, unknown>)) collect(x, out, seen);
  }
  return out;
}

/** String literals in screen source (copy that isn't in the catalogue). */
function literals(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(f)) {
        const src = fs.readFileSync(p, 'utf8').replace(/^\s*(\/\/|\*).*$/gm, '');
        for (const m of src.matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)) if (/\s/.test(m[2])) out.push(m[2]);
      }
    }
  };
  walk(dir);
  return out;
}

const root = path.join(__dirname, '../..');
const nonEvidence = { ...education, EDUCATION: education.EDUCATION.filter((e) => e.id !== 'ED-11') };
const catalogue = [
  ...collect([nonEvidence, exercise, items, learn, screening, strings]),
  ...literals(path.join(root, 'app')),
  ...literals(path.join(root, 'src/features')),
  ...collect(MODULES.filter((m) => !m.validated).map((m) => m.items)),
];
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

const CLAIM_WORDS = [
  /\btreat(s|ed|ing|ment|ments)?\b/i,
  /\btherap(y|ies|eutic)\b/i,
  /\bcur(e|es|ed|ing)\b/i,
  /\bfix(es|ed|ing)?\b/i,
  /\brevers(e|es|ed|ing)\b/i,
  /\bheal(s|ed|ing)?\b/i,
  /\bprevent(s|ed|ing|ion|ive)?\b/i,
  /\bdiagnos(e|es|ed|ing|is)\b/i,
  /clinically proven/i,
  /guarantee/i,
  /medically approved/i,
  /\byou suffer from\b/i,
  /\byour condition\b/i,
  /\b(mild|moderate|severe) incontinence\b/i,
  /\bincontinence\b/i,
  /erectile dysfunction/i,
  /premature ejaculation/i,
  /\bprostatitis\b/i,
  /\bprolapse\b/i,
];
// The disclaimer itself must say the app does not diagnose (CNT-020), so that one sentence is allowed.
const ALLOWED = [/does not diagnose any condition/, /They are not a diagnosis\./];

const GUILT = [/streak lost/i, /you missed/i, /you failed/i, /don't give up/i, /don’t give up/i, /you broke/i, /\bbehind (on|with)\b/i, /fall(en)? behind/i];
const BAD_CUES = [/pull your tummy in/i, /\bdraw(s)? in\b/i, /lift your bladder/i];
const NOTIFY_BLOCK = /\b(kegel|pelvic|floor|penis|testicle\w*|scrot\w*|erection|ejaculat\w*|bladder|pee|leak|urin\w*|incontinen\w*|sex\w*|prostate|squeeze|clench|pain)\b/i;

function strip(s: string) {
  return ALLOWED.reduce((acc, r) => acc.replace(r, ''), s);
}

describe('wording checks', () => {
  it('has a real catalogue to scan', () => {
    expect(catalogue.length).toBeGreaterThan(300);
  });

  it('makes no treatment or diagnosis claims (CNT-011)', () => {
    const hits = [...catalogue, readme].flatMap((s) => CLAIM_WORDS.filter((r) => r.test(strip(s))).map((r) => `${r} in: ${s.slice(0, 90)}`));
    expect(hits).toEqual([]);
  });

  it('has no guilt or loss wording (MOT-020, CNT-004)', () => {
    const hits = catalogue.flatMap((s) => GUILT.filter((r) => r.test(s)).map((r) => `${r} in: ${s.slice(0, 90)}`));
    expect(hits).toEqual([]);
  });

  it('never uses the cues that cause pushing or tummy bracing (LRN-013)', () => {
    const hits = catalogue.flatMap((s) => BAD_CUES.filter((r) => r.test(s)).map((r) => `${r} in: ${s.slice(0, 90)}`));
    expect(hits).toEqual([]);
  });

  it('keeps notification text discreet (CNT-040, REM-021)', () => {
    const texts = [
      ...reminders.DEFAULT_TEXTS,
      reminders.RELAX_TEXT,
      reminders.MONTHLY_TEXT,
      reminders.WEEKLY_TEXT,
      reminders.KNACK_TEXT,
      reminders.COMEBACK_TEXT,
      reminders.APP_TITLE,
      ...literals(path.join(root, 'src/platform')).filter((s) => !s.includes('/')),
    ];
    expect(texts.filter((t) => NOTIFY_BLOCK.test(t))).toEqual([]);
  });

  it('the blocklist catches a banned word (AC-REM-4)', () => {
    expect(NOTIFY_BLOCK.test('Time for your pelvic session')).toBe(true);
  });

  it('keeps sentences short (CNT-002)', () => {
    const long = collect([education.EDUCATION, strings, screening, learn])
      .flatMap((s) => s.split(/(?<=[.?!])\s+/))
      .filter((sentence) => sentence.split(/\s+/).length > 45);
    expect(long).toEqual([]);
  });

  it('labels every education screen with its findings (CNT-012)', () => {
    for (const e of education.EDUCATION) expect(e.findingIds.length).toBeGreaterThan(0);
  });
});
