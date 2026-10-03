// Questionnaire modules: schema, licence gate, scoring and missing-data rules (06b §3).

export type ResponseType = 'single' | 'multi' | 'numeric' | 'freeText';

export interface ModuleOption {
  label: string;
  value: number | string;
}

export interface ModuleItem {
  itemId: string;
  text: string;
  responseType: ResponseType;
  options: ModuleOption[];
  scored: boolean;
  subscale?: string;
  /** Show only when this condition on earlier answers holds (as the source defines). */
  gate?: { itemId: string; notIn: (number | string)[] };
  /** For 0-10 scales: labelled ends. */
  scale?: { min: number; max: number; minLabel: string; maxLabel: string };
  /** Goals this item applies to (app-own modules only). */
  goals?: string[];
  /** Profiles this item applies to (app-own modules only); all when absent. */
  profiles?: string[];
}

/** Whether an item applies to a profile (`profiles` on app-own items, for example erections for the male profile). */
export function itemForProfile(item: ModuleItem, anatomy: string): boolean {
  return !item.profiles || item.profiles.includes(anatomy);
}

export interface Licence {
  holder: string;
  licenceType: 'free-registered' | 'free-open' | 'paid' | 'unknown';
  status: 'notRequested' | 'pending' | 'granted' | 'declined' | 'expired';
  reference: string | null;
  grantedOn: string | null;
  permittedUse: string;
  conditions: string;
  copyrightNotice: string;
  reviewBy: string | null;
}

export interface QuestionnaireModule {
  moduleId: string;
  name: string;
  version: number;
  language: string;
  validated: boolean;
  profiles: string[];
  goals: string[];
  recall: { text: string; days: number };
  intervalDays: number;
  instructions: string;
  items: ModuleItem[];
  scoring: {
    method: 'sum' | 'sumSubscales' | 'custom' | 'none';
    subscales?: string[];
    range?: { min: number; max: number };
    direction?: 'higherIsWorse' | 'higherIsBetter';
    missingRule: 'none' | string;
  };
  mcid?: { type: 'fixed' | 'baselineBands'; values: number[]; source: string };
  floorValue?: number;
  ceilingValue?: number;
  licence: Licence;
}

/** QST-042 / DATA-101: a module is shown only when licensed (or free-open) and mapped to a goal. */
export function moduleAllowed(m: QuestionnaireModule): boolean {
  return m.licence.status === 'granted' || m.licence.licenceType === 'free-open';
}

export type AnswerValue = number | string | (number | string)[] | null; // null = skipped

export function itemVisible(item: ModuleItem, answers: Record<string, AnswerValue>): boolean {
  if (!item.gate) return true;
  const v = answers[item.gate.itemId];
  if (v == null) return true;
  return !item.gate.notIn.includes(v as number | string);
}

export interface ScoreResult {
  status: 'complete' | 'incomplete';
  total: number | null;
  subscales: Record<string, number> | null;
}

/** QST-043, QST-044: unscored items never count; any missing scored item makes the result incomplete. */
export function score(m: QuestionnaireModule, answers: Record<string, AnswerValue>): ScoreResult {
  const scored = m.items.filter((i) => i.scored && itemVisible(i, answers));
  const missing = scored.some((i) => answers[i.itemId] == null);
  if (m.scoring.method === 'none') {
    return { status: m.items.some((i) => itemVisible(i, answers) && answers[i.itemId] == null) ? 'incomplete' : 'complete', total: null, subscales: null };
  }
  if (missing && m.scoring.missingRule === 'none') return { status: 'incomplete', total: null, subscales: null };
  const num = (v: AnswerValue) => (typeof v === 'number' ? v : Number(v));
  const total = scored.reduce((s, i) => s + num(answers[i.itemId]), 0);
  let subscales: Record<string, number> | null = null;
  if (m.scoring.method === 'sumSubscales' && m.scoring.subscales) {
    subscales = {};
    for (const sub of m.scoring.subscales) {
      subscales[sub] = scored.filter((i) => i.subscale === sub).reduce((s, i) => s + num(answers[i.itemId]), 0);
    }
  }
  return { status: 'complete', total, subscales };
}

/** QST-045. */
export function possiblyRushed(durationS: number): boolean {
  return durationS < 20;
}

/** QST-060: baseline at floor or ceiling makes the module a "check-up". */
export function isCheckUp(m: QuestionnaireModule, baselineTotal: number | null): boolean {
  if (baselineTotal == null) return false;
  return (m.floorValue != null && baselineTotal === m.floorValue) || (m.ceilingValue != null && baselineTotal === m.ceilingValue);
}

/** PFB-021: meaningful change on a module with a fixed MCID (e.g. ICIQ-UI SF, baseline ≥ 6). */
export function meaningfulChange(m: QuestionnaireModule, baseline: number, latest: number): 'better' | 'worse' | 'none' | 'no_verdict' {
  if (!m.mcid || m.mcid.type !== 'fixed') return 'no_verdict';
  const [threshold, minBaseline = 0] = m.mcid.values;
  if (baseline < minBaseline) return 'no_verdict';
  const diff = latest - baseline;
  const worseIfHigher = m.scoring.direction !== 'higherIsBetter';
  if (Math.abs(diff) < threshold) return 'none';
  return diff > 0 === worseIfHigher ? 'worse' : 'better';
}

/** SHA-256 hex of a module's canonical content, excluding the stored hash (QST-033). */
export function canonicalContent(m: QuestionnaireModule): string {
  const { licence: _licence, ...rest } = m;
  void _licence;
  return JSON.stringify(rest);
}
