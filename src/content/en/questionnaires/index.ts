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
      // SX23, SX24: the bowel goal is tracked with ICIQ-B every quarter.
      bowel_control: { monthly: [], quarterly: ['iciq_b'] },
    },
  },
  // SX-D.5.1 (Adrian, 2026-10-03, SX20): ICIQ modules only, added to the ICIQ registration request. PFDI-20 stays out
  // until its licence is confirmed. SX27: app-own sexual items for women until the ICIQ registration comes through.
  female: {
    always: { monthly: ['iciq_ui_sf'], quarterly: ['iciq_ui_sf', 'app_global_change'] },
    goals: {
      bladder_control: { monthly: ['iciq_ui_sf'], quarterly: ['iciq_ui_sf', 'iciq_fluts'] },
      pregnancy_birth: { monthly: ['iciq_ui_sf'], quarterly: ['iciq_ui_sf', 'iciq_fluts'] },
      sexual_function: { monthly: ['iciq_flutssex', 'app_female_sexual'], quarterly: ['iciq_flutssex', 'app_female_sexual'] },
      bowel_control: { monthly: ['iciq_ui_sf'], quarterly: ['iciq_b'] },
      long_term_health: { monthly: ['iciq_ui_sf'], quarterly: ['iciq_ui_sf', 'app_global_change'] },
    },
  },
  other_unspecified: {
    always: { monthly: ['iciq_ui_sf'], quarterly: ['iciq_ui_sf', 'app_global_change'] },
    goals: {
      bowel_control: { monthly: [], quarterly: ['iciq_b'] },
    },
  },
};

/**
 * SX28: quarterly extras that take turns, so a review with several goals stays under 10 minutes (QST-011). With more
 * than one of them due, review N asks only the (N mod count)th. A heaviness or bulge answer adds ICIQ-VS (SX-D.5.1).
 */
export const ROTATING_QUARTERLY = ['iciq_fluts', 'iciq_vs', 'iciq_b', 'iciq_mluts'];

/** Module ids for a bundle, de-duplicated, with the SX28 rotation applied (no modules, just ids). */
export function bundleIds(anatomy: Anatomy, goals: Goal[], kind: 'monthly' | 'quarterly', opts: { reviewNo?: number; bulge?: boolean } = {}): string[] {
  const map = GOAL_MAPPING[anatomy];
  const ids: string[] = [...map.always[kind]];
  for (const g of goals) for (const id of map.goals[g]?.[kind] ?? []) if (!ids.includes(id)) ids.push(id);
  if (kind === 'quarterly' && anatomy === 'female' && opts.bulge && !ids.includes('iciq_vs')) ids.push('iciq_vs');
  const rotating = ids.filter((id) => ROTATING_QUARTERLY.includes(id) && verifiedModule(id) !== null);
  if (kind !== 'quarterly' || rotating.length < 2) return ids;
  const keep = rotating[(opts.reviewNo ?? 0) % rotating.length];
  return ids.filter((id) => !rotating.includes(id) || id === keep);
}

/** Modules for a bundle, validated modules before app-own ones (QST-013). */
export function bundleModules(anatomy: Anatomy, goals: Goal[], kind: 'monthly' | 'quarterly', opts: { reviewNo?: number; bulge?: boolean } = {}): QuestionnaireModule[] {
  const mods = bundleIds(anatomy, goals, kind, opts).map(verifiedModule).filter((m): m is QuestionnaireModule => m !== null);
  return [...mods.filter((m) => m.validated), ...mods.filter((m) => !m.validated)];
}
