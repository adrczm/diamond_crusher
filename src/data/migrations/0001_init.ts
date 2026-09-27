// Schema version 1 (spec 07 §3.3). Enum values are never renamed or reused after release (DATA-206).
import type { SqlDb } from '../sql';

const e = (col: string, values: string[], nullable = false) =>
  `CHECK (${nullable ? `${col} IS NULL OR ` : ''}${col} IN (${values.map((v) => `'${v}'`).join(', ')}))`;
const b = (col: string, nullable = false) => `CHECK (${nullable ? `${col} IS NULL OR ` : ''}${col} IN (0, 1))`;
const r = (col: string, lo: number, hi: number, nullable = true) =>
  `CHECK (${nullable ? `${col} IS NULL OR ` : ''}(${col} >= ${lo} AND ${col} <= ${hi}))`;

const ANATOMY = ['male', 'female', 'other_unspecified'];
const MODES = ['normal', 'caution', 'relax_only', 'blocked_until_cleared', 'blocked_urgent'];
const YNU = ['yes', 'no', 'unsure'];
const PAIN3 = ['no', 'a_little', 'yes'];
const POS = ['lying', 'sitting', 'standing'];
const SPOS = ['lying', 'sitting', 'standing', 'moving', 'mixed'];
const TS = 'created_at TEXT NOT NULL, updated_at TEXT';

export const SQL_0001 = `
CREATE TABLE meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  schema_version INTEGER NOT NULL,
  created_app_version TEXT NOT NULL,
  last_migrated_at TEXT,
  last_export_at TEXT,
  content_version INTEGER NOT NULL DEFAULT 1,
  ${TS}
);

CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  nickname TEXT CHECK (nickname IS NULL OR length(nickname) <= 30),
  anatomy TEXT ${e('anatomy', ANATOMY, true)},
  preferred_cue_key TEXT,
  disclaimer_ack_version INTEGER,
  disclaimer_ack_at TEXT,
  adult_confirmed_at TEXT,
  age_band TEXT ${e('age_band', ['18_29', '30_44', '45_59', '60_74', '75_plus'], true)},
  expectations_ack_at TEXT,
  onboarding_completed_at TEXT,
  onboarding_step INTEGER NOT NULL DEFAULT 0,
  locale TEXT NOT NULL DEFAULT 'en',
  ${TS}
);

CREATE TABLE profile_goal (
  goal TEXT PRIMARY KEY ${e('goal', ['bladder_control', 'ejaculatory_control', 'erection', 'long_term_health'])},
  added_at TEXT NOT NULL,
  active INTEGER NOT NULL ${b('active')},
  ${TS}
);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  sessions_per_day_target INTEGER NOT NULL DEFAULT 3 ${r('sessions_per_day_target', 2, 3, false)},
  weekly_days_target INTEGER NOT NULL DEFAULT 5 ${r('weekly_days_target', 3, 7, false)},
  maintenance_days_target INTEGER ${r('maintenance_days_target', 3, 7)},
  week_start_day INTEGER NOT NULL DEFAULT 1 ${r('week_start_day', 1, 7, false)},
  audio_mode TEXT NOT NULL DEFAULT 'tones' ${e('audio_mode', ['off', 'tones', 'voice'])},
  vibration INTEGER NOT NULL DEFAULT 1 ${b('vibration')},
  theme TEXT NOT NULL DEFAULT 'system' ${e('theme', ['system', 'light', 'dark'])},
  monthly_check_weekday INTEGER ${r('monthly_check_weekday', 1, 7)},
  export_reminder_days INTEGER NOT NULL DEFAULT 30,
  knack_nudge_enabled INTEGER NOT NULL DEFAULT 0 ${b('knack_nudge_enabled')},
  knack_nudge_time TEXT,
  functional_cues_enabled INTEGER NOT NULL DEFAULT 1 ${b('functional_cues_enabled')},
  precise_reminders INTEGER NOT NULL DEFAULT 0 ${b('precise_reminders')},
  notification_permission TEXT NOT NULL DEFAULT 'undetermined' ${e('notification_permission', ['granted', 'denied', 'undetermined'])},
  lock_screen_mode TEXT NOT NULL DEFAULT 'private' ${e('lock_screen_mode', ['private', 'secret'])},
  reminders_paused INTEGER NOT NULL DEFAULT 0 ${b('reminders_paused')},
  reminders_paused_until TEXT,
  reminder_backoff_state TEXT NOT NULL DEFAULT 'normal' ${e('reminder_backoff_state', ['normal', 'first_slot_only', 'stopped'])},
  last_delivery_test_at TEXT,
  last_delivery_test_result TEXT ${e('last_delivery_test_result', ['seen', 'not_seen'], true)},
  plan_review_offered_at TEXT,
  weekly_summary_notification INTEGER NOT NULL DEFAULT 0 ${b('weekly_summary_notification')},
  chart_range TEXT NOT NULL DEFAULT 'since_baseline' ${e('chart_range', ['since_baseline', '12w', '12m'])},
  floor_ceiling_explained TEXT NOT NULL DEFAULT '{}',
  lock_enabled INTEGER NOT NULL DEFAULT 0 ${b('lock_enabled')},
  lock_timeout_s INTEGER NOT NULL DEFAULT 60,
  ${TS}
);

CREATE TABLE screening_run (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL ${e('kind', ['onboarding', 'something_changed', 'review_12w', 'anatomy_change', 'periodic', 'after_gap', 'post_session', 'post_learn', 'clearance'])},
  question_set_version INTEGER NOT NULL,
  anatomy_at_run TEXT NOT NULL ${e('anatomy_at_run', ANATOMY)},
  started_at TEXT NOT NULL,
  completed_at TEXT,
  outcome TEXT ${e('outcome', MODES, true)},
  source_ref TEXT,
  ${TS}
);

CREATE TABLE screening_answer (
  run_id TEXT NOT NULL REFERENCES screening_run(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  answer TEXT NOT NULL ${e('answer', ['yes', 'no', 'skipped'])},
  value_date TEXT,
  answered_at TEXT NOT NULL,
  ${TS},
  PRIMARY KEY (run_id, question_key)
);

CREATE TABLE safety_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mode TEXT NOT NULL ${e('mode', MODES)},
  reasons TEXT NOT NULL DEFAULT '[]',
  since TEXT NOT NULL,
  set_by_run_id TEXT,
  professional_clearance_at TEXT,
  strengthening_paused_reason TEXT NOT NULL DEFAULT 'none' ${e('strengthening_paused_reason', ['none', 'pain_report', 'screen'])},
  ${TS}
);

CREATE TABLE safety_flag (
  id TEXT PRIMARY KEY,
  flag_key TEXT NOT NULL,
  signal_key TEXT,
  raised_at TEXT NOT NULL,
  source_ref TEXT,
  dismissed_at TEXT,
  response TEXT ${e('response', ['dismissed', 'will_book', 'already_seen'], true)},
  ${TS}
);

CREATE TABLE learn_attempt (
  id TEXT PRIMARY KEY,
  sitting_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL,
  kind TEXT NOT NULL ${e('kind', ['sitting', 'recheck'])},
  started_at TEXT NOT NULL,
  position TEXT NOT NULL ${e('position', ['lying', 'standing'])},
  cue_key TEXT NOT NULL,
  check_mirror TEXT NOT NULL ${e('check_mirror', ['yes', 'no', 'unsure', 'not_done'])},
  check_touch TEXT NOT NULL ${e('check_touch', ['lifted', 'bulged', 'unsure', 'not_done'])},
  felt_release TEXT ${e('felt_release', YNU, true)},
  mistakes TEXT NOT NULL DEFAULT '{}',
  push_down_sign INTEGER NOT NULL ${b('push_down_sign')},
  good INTEGER NOT NULL ${b('good')},
  result TEXT ${e('result', ['pass', 'not_sure', 'push_down'], true)},
  ${TS}
);

CREATE TABLE content_view (
  content_key TEXT NOT NULL,
  content_version INTEGER NOT NULL,
  first_seen_at TEXT NOT NULL,
  completed_at TEXT,
  ${TS},
  PRIMARY KEY (content_key, content_version)
);

CREATE TABLE programme_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  phase TEXT NOT NULL DEFAULT 'learn' ${e('phase', ['learn', 'build', 'maintenance', 'return_to_build', 'relax_only', 'pre_surgery', 'paused'])},
  learn_status TEXT NOT NULL DEFAULT 'not_started' ${e('learn_status', ['not_started', 'in_progress', 'passed', 'unconfirmed_proceeding', 'locked_push_down'])},
  learn_unsure_sittings INTEGER NOT NULL DEFAULT 0,
  learn_first_sitting_at TEXT,
  learn_passed_at TEXT,
  stop_test_shown_at TEXT,
  stop_test_result TEXT ${e('stop_test_result', ['could', 'could_not', 'skipped'], true)},
  last_technique_recheck_at TEXT,
  technique_prompt_at TEXT,
  build_started_on TEXT,
  active_days INTEGER NOT NULL DEFAULT 0,
  maintenance_since TEXT,
  hold_s INTEGER NOT NULL DEFAULT 3 ${r('hold_s', 3, 10, false)},
  hold_reps INTEGER NOT NULL DEFAULT 8 ${r('hold_reps', 3, 10, false)},
  flick_reps INTEGER NOT NULL DEFAULT 10 ${r('flick_reps', 10, 10, false)},
  endurance_enabled INTEGER NOT NULL DEFAULT 0 ${b('endurance_enabled')},
  endurance_hold_s INTEGER NOT NULL DEFAULT 5 ${r('endurance_hold_s', 5, 10, false)},
  unlocked_positions TEXT NOT NULL DEFAULT '["lying"]',
  position_tier INTEGER NOT NULL DEFAULT 0 ${r('position_tier', 0, 3, false)},
  hold_ceiling INTEGER NOT NULL DEFAULT 5 ${r('hold_ceiling', 3, 10, false)},
  last_category TEXT ${e('last_category', ['strength', 'endurance', 'position'], true)},
  rotation_index INTEGER NOT NULL DEFAULT -1,
  last_strength_variable TEXT ${e('last_strength_variable', ['hold_s', 'hold_reps'], true)},
  tier2_qualifying_weeks INTEGER NOT NULL DEFAULT 0,
  regression_hold_until TEXT,
  keep_building_until_active_day INTEGER,
  return_to_build_until_active_day INTEGER,
  template_key TEXT NOT NULL DEFAULT 'strength',
  template_version INTEGER NOT NULL DEFAULT 1,
  planned_surgery_date TEXT,
  last_session_date TEXT,
  last_evaluated_at TEXT,
  last_evaluated_week INTEGER NOT NULL DEFAULT 0,
  baseline_offer_until TEXT,
  knack_taught_at TEXT,
  ${TS}
);

CREATE TABLE level_change (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  reason TEXT NOT NULL ${e('reason', ['initial', 'progression', 'monthly_check', 'ceiling', 'confirmed_drop', 'hold', 'step_back', 'position_unlock', 'to_maintenance', 'keep_building', 'return_to_build', 'restart_after_gap', 'post_surgery', 'pain_pause', 'manual', 'import'])},
  variable TEXT NOT NULL ${e('variable', ['hold_s', 'hold_reps', 'flick_reps', 'endurance', 'endurance_hold_s', 'position', 'phase', 'none'])},
  before TEXT,
  after TEXT,
  evidence_ref TEXT,
  ${TS}
);

CREATE TABLE training_slot (
  id TEXT PRIMARY KEY,
  slot_no INTEGER NOT NULL UNIQUE ${r('slot_no', 1, 3, false)},
  anchor_key TEXT,
  anchor_custom TEXT CHECK (anchor_custom IS NULL OR length(anchor_custom) <= 40),
  default_position TEXT ${e('default_position', POS, true)},
  active INTEGER NOT NULL DEFAULT 1 ${b('active')},
  ${TS}
);

CREATE TABLE session (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  local_date TEXT NOT NULL,
  tz_offset_min INTEGER NOT NULL,
  slot_no INTEGER,
  mode TEXT NOT NULL ${e('mode', ['standard', 'relax_only', 'maintenance', 'pre_surgery', 'restart'])},
  position TEXT NOT NULL ${e('position', SPOS)},
  template_key TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  planned TEXT NOT NULL,
  completion TEXT NOT NULL ${e('completion', ['complete', 'partial', 'stopped_pain'])},
  active_duration_s INTEGER NOT NULL DEFAULT 0,
  counts_toward_day INTEGER NOT NULL ${b('counts_toward_day')},
  from_reminder_id TEXT,
  ${TS}
);
CREATE INDEX session_local_date ON session(local_date);

CREATE TABLE exercise_set (
  session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  block TEXT NOT NULL ${e('block', ['relax_open', 'hold', 'flick', 'endurance', 'functional_practice', 'relax_close', 'breathing'])},
  position TEXT NOT NULL ${e('position', SPOS)},
  planned_reps INTEGER NOT NULL,
  planned_hold_s REAL NOT NULL,
  planned_rest_s REAL NOT NULL,
  completed_reps INTEGER NOT NULL,
  end_reason TEXT NOT NULL ${e('end_reason', ['completed', 'quality_drop', 'user_stop', 'pain', 'interrupted'])},
  near_max_contractions INTEGER NOT NULL DEFAULT 0,
  ${TS},
  PRIMARY KEY (session_id, seq)
);

CREATE TABLE session_log (
  session_id TEXT PRIMARY KEY REFERENCES session(id) ON DELETE CASCADE,
  feel INTEGER ${r('feel', 1, 5)},
  pain TEXT ${e('pain', PAIN3, true)},
  off_ticks TEXT,
  item_set_version INTEGER NOT NULL,
  logged_at TEXT NOT NULL,
  ${TS}
);

CREATE TABLE self_check (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL ${e('kind', ['baseline', 'monthly', 'ad_hoc'])},
  performed_at TEXT NOT NULL,
  local_date TEXT NOT NULL,
  tz_offset_min INTEGER NOT NULL,
  completed_at TEXT,
  position TEXT NOT NULL ${e('position', ['lying', 'standing'])},
  anatomy_at_check TEXT NOT NULL ${e('anatomy_at_check', ANATOMY)},
  bladder_empty INTEGER NOT NULL ${b('bladder_empty')},
  not_after_session INTEGER NOT NULL ${b('not_after_session')},
  same_position INTEGER NOT NULL ${b('same_position')},
  time_of_day_shifted INTEGER NOT NULL DEFAULT 0 ${b('time_of_day_shifted')},
  sign_method TEXT NOT NULL DEFAULT 'none' ${e('sign_method', ['mirror', 'touch', 'none'])},
  sign_result TEXT ${e('sign_result', ['yes', 'no', 'unsure', 'not_done'], true)},
  bulge TEXT ${e('bulge', YNU, true)},
  longest_hold_s INTEGER ${r('longest_hold_s', 0, 30)},
  longest_hold_retry_s INTEGER ${r('longest_hold_retry_s', 0, 30)},
  repeated_hold_len_s INTEGER ${r('repeated_hold_len_s', 2, 10)},
  repeated_holds INTEGER ${r('repeated_holds', 0, 10)},
  quick_flicks INTEGER ${r('quick_flicks', 0, 10)},
  breathing_ok TEXT ${e('breathing_ok', YNU, true)},
  glutes_belly_relaxed TEXT ${e('glutes_belly_relaxed', YNU, true)},
  full_release TEXT ${e('full_release', YNU, true)},
  pain TEXT ${e('pain', PAIN3, true)},
  technique_flag INTEGER NOT NULL DEFAULT 0 ${b('technique_flag')},
  technique_unsure_at_baseline INTEGER NOT NULL DEFAULT 0 ${b('technique_unsure_at_baseline')},
  aborted_at_step INTEGER ${r('aborted_at_step', 1, 6)},
  status TEXT NOT NULL ${e('status', ['complete', 'incomplete'])},
  item_set_version INTEGER NOT NULL,
  scheduled_check_id TEXT,
  ${TS}
);

CREATE TABLE event (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL ${e('type', ['leak', 'sexual_activity'])},
  occurred_at TEXT NOT NULL,
  local_date TEXT NOT NULL,
  tz_offset_min INTEGER NOT NULL,
  entered_at TEXT NOT NULL,
  leak_situation TEXT ${e('leak_situation', ['cough_sneeze', 'lifting', 'urge', 'after_urinating', 'other'], true)},
  leak_amount TEXT ${e('leak_amount', ['drops', 'more'], true)},
  activity_type TEXT ${e('activity_type', ['penetrative_vaginal', 'other_partnered', 'solo'], true)},
  hardness INTEGER ${r('hardness', 0, 4)},
  ejac_time_band TEXT ${e('ejac_time_band', ['lt1', '1to2', '2to3', '3to5', '5to10', '10to20', '20to30', 'gt30', 'no_ejaculation', 'not_sure'], true)},
  ejac_time_min REAL ${r('ejac_time_min', 0.1, 120)},
  control_0_10 INTEGER ${r('control_0_10', 0, 10)},
  bother_0_10 INTEGER ${r('bother_0_10', 0, 10)},
  item_set_version INTEGER NOT NULL,
  ${TS},
  CHECK (type = 'leak' OR (leak_situation IS NULL AND leak_amount IS NULL)),
  CHECK (type = 'sexual_activity' OR (activity_type IS NULL AND hardness IS NULL AND ejac_time_band IS NULL AND ejac_time_min IS NULL AND control_0_10 IS NULL AND bother_0_10 IS NULL))
);

CREATE TABLE context_flag (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL ${e('kind', ['illness', 'alcohol', 'new_medication', 'tired_stressed', 'no_sexual_activity_period', 'other'])},
  from_date TEXT NOT NULL,
  to_date TEXT,
  note TEXT CHECK (note IS NULL OR length(note) <= 60),
  ${TS}
);

CREATE TABLE scheduled_check (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL ${e('kind', ['baseline', 'monthly_check', 'quarterly_review', 'periodic_safety', 'export_backup', 'milestone_review'])},
  due_on TEXT NOT NULL,
  window_open TEXT NOT NULL,
  window_close TEXT NOT NULL,
  status TEXT NOT NULL ${e('status', ['upcoming', 'open', 'partial', 'completed', 'missed', 'skipped'])},
  completed_at TEXT,
  completed_ref TEXT,
  parts_done TEXT NOT NULL DEFAULT '[]',
  ${TS}
);

CREATE TABLE questionnaire_response (
  id TEXT PRIMARY KEY,
  scheduled_check_id TEXT,
  instrument_key TEXT NOT NULL,
  instrument_version INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  context TEXT NOT NULL ${e('context', ['baseline', 'monthly', 'quarterly', 'ad_hoc'])},
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_s INTEGER,
  status TEXT NOT NULL ${e('status', ['in_progress', 'complete', 'incomplete', 'abandoned'])},
  total_score REAL,
  subscale_scores TEXT,
  scoring_version INTEGER NOT NULL,
  flags TEXT NOT NULL DEFAULT '[]',
  consistency_note_action TEXT ${e('consistency_note_action', ['kept', 'reviewed'], true)},
  ${TS}
);

CREATE TABLE questionnaire_answer (
  response_id TEXT NOT NULL REFERENCES questionnaire_response(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  value_num REAL,
  value_text TEXT,
  skipped INTEGER NOT NULL ${b('skipped')},
  answered_at TEXT NOT NULL,
  ${TS},
  PRIMARY KEY (response_id, item_key)
);

CREATE TABLE reminder (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL ${e('kind', ['session', 'monthly_check', 'quarterly_review', 'weekly_summary', 'knack_nudge', 'comeback_note'])},
  slot_no INTEGER,
  enabled INTEGER NOT NULL ${b('enabled')},
  time_local TEXT NOT NULL,
  weekdays INTEGER NOT NULL DEFAULT 127,
  title TEXT CHECK (title IS NULL OR length(title) <= 40),
  body TEXT CHECK (body IS NULL OR length(body) <= 80),
  os_ids TEXT NOT NULL DEFAULT '[]',
  last_scheduled_at TEXT,
  ${TS}
);

CREATE TABLE reminder_action (
  id TEXT PRIMARY KEY,
  reminder_id TEXT REFERENCES reminder(id) ON DELETE CASCADE,
  scheduled_for TEXT,
  action TEXT NOT NULL ${e('action', ['opened', 'snoozed', 'done_already', 'dismissed', 'test_sent', 'test_received'])},
  at TEXT NOT NULL,
  ${TS}
);

CREATE TABLE milestone (
  key TEXT PRIMARY KEY,
  reached_at TEXT NOT NULL,
  seen_at TEXT,
  ref TEXT,
  ${TS}
);

CREATE TABLE functional_habit_day (
  local_date TEXT PRIMARY KEY,
  used INTEGER NOT NULL ${b('used')},
  answered_at TEXT NOT NULL,
  ${TS}
);

CREATE TABLE weekly_summary (
  week_start TEXT PRIMARY KEY,
  days_trained INTEGER NOT NULL,
  target_days INTEGER NOT NULL,
  sessions_counted INTEGER NOT NULL,
  sessions_planned INTEGER NOT NULL,
  message_id TEXT,
  pain_reported INTEGER NOT NULL ${b('pain_reported')},
  progression_note TEXT ${e('progression_note', ['sessions', 'other'], true)},
  viewed_at TEXT,
  ${TS}
);

CREATE TABLE message_event (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  shown_at TEXT NOT NULL,
  surface TEXT NOT NULL ${e('surface', ['progress_header', 'weekly_summary', 'check_result'])},
  ${TS}
);

CREATE TABLE data_op_log (
  id TEXT PRIMARY KEY,
  op TEXT NOT NULL ${e('op', ['created', 'migrated', 'exported', 'imported_replace', 'imported_merge', 'lock_on', 'lock_off', 'restart_after_unreadable'])},
  at TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}',
  ${TS}
);
`;

export async function up(db: SqlDb): Promise<void> {
  await db.exec(SQL_0001);
}
