// Content checks (05 CNT-004, CNT-011, CNT-040; 08 MOT-020, REM-021; 02 LRN-013; STE and voice rules from
// research/ux-writing/style-guide.md sections a, b and e).
import * as fs from 'fs';
import * as path from 'path';
import * as checkin from '../../src/content/en/checkin';
import * as education from '../../src/content/en/education';
import * as exercise from '../../src/content/en/exercise';
import * as items from '../../src/content/en/items';
import * as learn from '../../src/content/en/learn';
import * as screening from '../../src/content/en/screening';
import * as strings from '../../src/content/en/strings';
import { SYNC } from '../../src/content/en/sync';
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

/** String literals in one source file (for web.ts, which must not be called: it changes the shared catalogue). */
function fileLiterals(file: string): string[] {
  const src = fs.readFileSync(file, 'utf8').replace(/^\s*(\/\/|\*).*$/gm, '');
  return [...src.matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)].map((m) => m[2]).filter((t) => /\s/.test(t));
}

const root = path.join(__dirname, '../..');
const nonEvidence = { ...education, EDUCATION: education.EDUCATION.filter((e) => e.id !== 'ED-11') };
const catalogue = [
  ...collect([nonEvidence, exercise, items, learn, screening, strings, checkin]),
  ...literals(path.join(root, 'app')),
  ...literals(path.join(root, 'src/features')),
  ...literals(path.join(root, 'src/ui')),
  ...collect(MODULES.filter((m) => !m.validated).map((m) => m.items)),
];
// Copy from the content catalogue only (no screen source), for the STE checks.
const content = [
  ...collect([nonEvidence, exercise, items, learn, screening, strings, SYNC, checkin]),
  ...collect(MODULES.filter((m) => !m.validated).map((m) => m.items)),
  ...fileLiterals(path.join(root, 'src/content/en/web.ts')),
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
// "Prostate treatment" names the person's past care, not a claim (G2 card text approved by Adrian, 2026-10-03).
const ALLOWED = [/does not diagnose any condition/, /They are not a diagnosis\./, /prostate treatment/, /hormone therapy/gi];

const GUILT = [/streak lost/i, /you missed/i, /you failed/i, /don't give up/i, /don’t give up/i, /you broke/i, /\bbehind (on|with)\b/i, /fall(en)? behind/i];
const BAD_CUES = [/pull your tummy in/i, /\bdraw(s)? in\b/i, /lift your bladder/i];
const NOTIFY_BLOCK = /\b(kegel|pelvic|floor|penis|testicle\w*|scrot\w*|erection|ejaculat\w*|bladder|pee|leak|urin\w*|incontinen\w*|sex\w*|prostate|squeeze|clench|pain)\b/i;

// STE checklist items 6, 16 and 29, the word list in section d and the emoji and "!" rules in section e.
const CONTRACTION = /\b(\w+n['’]t|(i|you|we|they|it|that|there|what|here|let|he|she|who)['’](s|re|ve|ll|d|m))\b/i;
const STE_BANNED = [/;/, /\b(ensure|verify|confirm|utilise|commence|facilitate|leverage|empower|please)\b/i];
const VOICE_BANNED = [
  /\bjourney\b/i,
  /got this/i,
  /\bcrush(es|ed|ing)?\b/i,
  /beast/i,
  /\bsmash/i,
  /rockstar|superstar|\bchamp\b|\bbuddy\b|woohoo|\boops\b|uh-oh/i,
  /let['’]s do this/i,
  /\bstamina\b|\bbedroom\b|\bmanhood\b|down there|tough it out/i,
  /\binvalid\b|input required|\bcompliance\b|\badherence\b/i,
  /!!/,
  /\p{Extended_Pictographic}/u,
];

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

  // SX-C.6, summary item 10: "breathe out ... draw in the tummy" made 84% of women push down (Ben Ami and Dar 2018).
  it('never joins "breathe out" with a tummy, belly or draw-in cue in one cue, fix or tip', () => {
    const cueStrings = collect([
      learn.CUES,
      learn.REMINDER_CUES,
      learn.MISTAKES,
      learn.LEARN,
      learn.MIRROR_CHECK,
      learn.TOUCH_CHECK,
      learn.INSIDE_CHECK,
      exercise.KNACK,
      exercise.AFTER_PEE,
      exercise.URGE_CONTROL,
      exercise.ADD_ONS,
      exercise.INTENSITY,
      // RELAX_STEP_TEXT is left out on purpose: its let-go breath softens the belly and asks for no squeeze.
      exercise.everydaySqueezes('male', { bulge: true, urgency: true }),
      exercise.everydaySqueezes('female', { bulge: true, urgency: true }),
      Object.values(learn.CUES).flatMap((c) => Object.keys(c.text).map((k) => learn.sessionCueText(k, 'male'))),
    ]);
    expect(cueStrings.length).toBeGreaterThan(30);
    const joined = cueStrings.filter((s) => /breathe\s+out/i.test(s) && /\b(tummy|belly|draw(s)?\s+in)\b/i.test(s));
    expect(joined).toEqual([]);
    // The check itself catches the pairing.
    expect(/breathe\s+out/i.test('Breathe out and draw in your tummy') && /\b(tummy|belly|draw(s)?\s+in)\b/i.test('Breathe out and draw in your tummy')).toBe(true);
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
    const long = collect([education.EDUCATION, strings, screening, learn, checkin])
      .flatMap((s) => s.split(/(?<=[.?!])\s+/))
      .filter((sentence) => sentence.split(/\s+/).length > 45);
    expect(long).toEqual([]);
  });

  it('labels every education screen with its findings (CNT-012)', () => {
    for (const e of education.EDUCATION) expect(e.findingIds.length).toBeGreaterThan(0);
  });

  it('uses no contractions (STE 4.2)', () => {
    expect(content.filter((s) => CONTRACTION.test(s))).toEqual([]);
  });

  it('uses no semicolons or banned STE words (STE 8.1, "make sure" rule)', () => {
    const hits = content.flatMap((s) => STE_BANNED.filter((r) => r.test(s)).map((r) => `${r} in: ${s.slice(0, 90)}`));
    expect(hits).toEqual([]);
  });

  it('has no cheesy, innuendo or cold words, emoji or stacked "!" (style guide b, d, e)', () => {
    const hits = content.flatMap((s) => VOICE_BANNED.filter((r) => r.test(s)).map((r) => `${r} in: ${s.slice(0, 90)}`));
    expect(hits).toEqual([]);
  });

  it('keeps app and sync sentences to 25 words or fewer (STE 6.3)', () => {
    const long = collect([strings, SYNC, checkin])
      .concat(fileLiterals(path.join(root, 'src/content/en/web.ts')))
      .flatMap((s) => s.split(/(?<=[.?!])\s+/))
      .filter((sentence) => sentence.split(/\s+/).length > 25);
    expect(long).toEqual([]);
  });

  it('keeps buttons to 3 words or fewer, with no end punctuation (style guide e)', () => {
    const s = strings;
    const buttons = [
      ...Object.values(s.COMMON).filter((b) => b !== s.COMMON.loading),
      s.ONBOARDING.start, s.ONBOARDING.importBackup, s.ONBOARDING.lockOn, s.ONBOARDING.lockOff,
      s.PLAN.allowReminders, s.PLAN.noReminders, s.PLAN.sendTest, s.PLAN.openSettings, s.PLAN.reviewPlan,
      s.HOME.startSession, s.WELCOME_BACK.easier, s.WELCOME_BACK.pickUp,
      s.MAINTENANCE.switch, s.MAINTENANCE.keepBuilding, s.MAINTENANCE.topUpAccept, s.MAINTENANCE.topUpDecline,
      s.BUNDLE.startPart, s.BUNDLE.keep, s.BUNDLE.review, s.BUNDLE.skip, s.BUNDLE.selfCheckNow,
      s.SETTINGS.resume, s.SETTINGS.undo, s.SETTINGS.editTimes, s.SETTINGS.turnOn, s.DATA.export, s.DATA.import, s.UNREADABLE.import, s.DATA.pickFile, s.DATA.unlockFile, s.DATA.deleteButton,
      s.LOCK.unlock, s.LOCK.erase, s.UNREADABLE.fresh, s.DESKTOP.start,
      SYNC.entryButton, SYNC.entryButtonPaired, SYNC.pairShow, SYNC.pairScan, SYNC.pairShowNext, SYNC.match, SYNC.noMatch,
      SYNC.send, SYNC.receive, SYNC.sendEverything, SYNC.unpair, SYNC.sendNext, SYNC.sendDone, SYNC.receivedNext,
      SYNC.cameraAllow, SYNC.cancel, SYNC.back,
      checkin.CHECKIN.start, checkin.CHECKIN.hold.lighterButton, checkin.CHECKIN.hold.checkAgain, checkin.CHECKIN.suggest.action,
    ];
    const bad = buttons.filter((b) => b.split(/\s+/).length > 3 || /[.!?:;,]$/.test(b));
    expect(bad).toEqual([]);
  });

  // DS-P1: copy lives in src/content/en, where these checks can read it. Screens and the UI kit hold no English text.
  it('keeps English copy out of screen and UI code', () => {
    const offenders: string[] = [];
    const walk = (d: string) => {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (f.endsWith('.tsx')) {
          const src = fs.readFileSync(p, 'utf8');
          for (const m of src.matchAll(/(label|text|title|placeholder|accessibilityLabel)="([^"]*[A-Za-z]{2}[^"]*)"/g)) offenders.push(`${path.relative(root, p)}: ${m[0]}`);
          for (const m of src.matchAll(/>([ \t]*[A-Z][a-z][^<>{}()=;'"\n]*)<\//g)) offenders.push(`${path.relative(root, p)}: ${m[1].trim()}`);
        }
      }
    };
    for (const d of ['app', 'src/features', 'src/ui']) walk(path.join(root, d));
    expect(offenders).toEqual([]);
  });
});
