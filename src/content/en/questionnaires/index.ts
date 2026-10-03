// Bundled questionnaire modules, their hashes and the goal mapping (06b QST-010, QST-033, QST-040 to QST-042).
// Validated instruments (ICIQ and others) are listed in the mapping but ship only once a licence is held;
// until then they are simply absent (QST-012).
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { canonicalContent, moduleAllowed, type QuestionnaireModule } from '../../../domain/questionnaire';
import type { Anatomy, Goal } from '../../../domain/types';
import globalChange from './app_global_change.v1.json';
import monthlySexual from './app_monthly_sexual.v1.json';
import symptomCheckin from './app_symptom_checkin.v1.json';
import manifest from './manifest.json';

/** 06c PFB-048: the symptom check-in. Offered on its own (never in a bundle), so it is not in GOAL_MAPPING. */
export const CHECKIN_MODULE_ID = 'app_symptom_checkin';

export const MODULES: QuestionnaireModule[] = [
  monthlySexual as QuestionnaireModule,
  globalChange as QuestionnaireModule,
  symptomCheckin as QuestionnaireModule,
];

export function contentHash(m: QuestionnaireModule): string {
  return bytesToHex(sha256(utf8ToBytes(canonicalContent(m))));
}

/** QST-033: a module whose content doesn't match its manifest hash is never shown. */
export function verifiedModule(id: string): QuestionnaireModule | null {
  const m = MODULES.find((x) => x.moduleId === id);
  if (!m) return null;
  const entry = (manifest as { moduleId: string; version: number; contentHash: string }[]).find(
    (e) => e.moduleId === id && e.version === m.version
  );
  if (!entry || entry.contentHash !== contentHash(m)) return null;
  return moduleAllowed(m) ? m : null;
}

type Mapping = { monthly: string[]; quarterly: string[] };

/** QST-010: goal → modules, per profile. Order is the bundle order (QST-013). */
export const GOAL_MAPPING: Record<Anatomy, { always: Mapping; goals: Partial<Record<Goal, Mapping>> }> = {
  male: {
    always: { monthly: ['iciq_ui_sf'], quarterly: ['iciq_ui_sf', 'app_global_change'] },
    goals: {
      bladder_control: { monthly: ['iciq_ui_sf'], quarterly: ['iciq_ui_sf', 'iciq_mluts'] },
      erection: { monthly: ['iciq_mlutssex', 'app_monthly_sexual'], quarterly: ['iciq_mlutssex', 'app_monthly_sexual'] },
      ejaculatory_control: { monthly: ['iciq_mlutssex', 'app_monthly_sexual'], quarterly: ['iciq_mlutssex', 'app_monthly_sexual'] },
      long_term_health: { monthly: ['iciq_ui_sf'], quarterly: ['iciq_ui_sf', 'app_global_change'] },
    },
  },
  female: {
    always: { monthly: ['iciq_ui_sf'], quarterly: ['iciq_ui_sf', 'pfdi_20', 'app_global_change'] },
    goals: {},
  },
  other_unspecified: {
    always: { monthly: ['iciq_ui_sf'], quarterly: ['iciq_ui_sf', 'app_global_change'] },
    goals: {},
  },
};

/** Module ids for a bundle, de-duplicated, validated modules before app-own ones (QST-013). */
export function bundleModules(anatomy: Anatomy, goals: Goal[], kind: 'monthly' | 'quarterly'): QuestionnaireModule[] {
  const map = GOAL_MAPPING[anatomy];
  const ids: string[] = [...map.always[kind]];
  for (const g of goals) for (const id of map.goals[g]?.[kind] ?? []) if (!ids.includes(id)) ids.push(id);
  const mods = ids.map(verifiedModule).filter((m): m is QuestionnaireModule => m !== null);
  return [...mods.filter((m) => m.validated), ...mods.filter((m) => !m.validated)];
}
