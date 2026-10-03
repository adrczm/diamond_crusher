// What syncs between a paired phone and Mac, and how (07 SYNC-014, SYNC-015).
import type { TableName } from '../migrations';

/** Tables whose rows sync one by one; a higher `hlc` wins and tombstones remove rows (SYNC-014). */
export const ROW_TABLES: TableName[] = [
  'profile_goal',
  'screening_run',
  'screening_answer',
  'safety_flag',
  'learn_attempt',
  'content_view',
  'level_change',
  'training_slot',
  'session',
  'exercise_set',
  'session_log',
  'self_check',
  'event',
  'context_flag',
  'scheduled_check',
  'questionnaire_response',
  'questionnaire_answer',
  'reminder',
  'milestone',
  'functional_habit_day',
  'weekly_summary',
  'message_event',
];

/** Single-row tables that sync field by field (SYNC-013). */
export const FIELD_TABLES: TableName[] = ['profile', 'settings', 'programme_state', 'safety_state'];

/**
 * Columns that belong to one device and never sync (SYNC-015): the OS notification permission and its test, Android
 * exact alarms, the app lock (its key lives in this device's secure store), theme, sound and vibration, scheduled OS
 * notification ids, and the active-day count, which is recalculated from the merged sessions.
 */
export const DEVICE_COLUMNS: Partial<Record<TableName, string[]>> = {
  // Theme, sound and vibration belong to each device too (decision 3, 2026-09-29): muting the Mac must not mute the phone.
  settings: [
    'notification_permission',
    'precise_reminders',
    'last_delivery_test_at',
    'last_delivery_test_result',
    'lock_enabled',
    'lock_timeout_s',
    'theme',
    'audio_mode',
    'vibration',
    // The Today top card (Path or Rings) is chosen per device; today_hero_shared carries it when the person syncs it.
    'today_hero',
  ],
  programme_state: ['active_days'],
  reminder: ['os_ids', 'last_scheduled_at'],
};

/** Fields that must change together take the newest side as a group (SYNC-013). */
export const FIELD_GROUPS: Partial<Record<TableName, string[][]>> = {
  programme_state: [
    ['phase', 'maintenance_since', 'build_started_on', 'keep_building_until_active_day', 'return_to_build_until_active_day', 'regression_hold_until', 'planned_surgery_date', 'baseline_offer_until'],
    ['learn_status', 'learn_unsure_sittings', 'learn_first_sitting_at', 'learn_passed_at'],
    [
      'hold_s',
      'hold_reps',
      'flick_reps',
      'endurance_enabled',
      'endurance_hold_s',
      'unlocked_positions',
      'position_tier',
      'hold_ceiling',
      'last_category',
      'rotation_index',
      'last_strength_variable',
      'tier2_qualifying_weeks',
      'last_evaluated_week',
      'last_evaluated_at',
      'template_key',
      'template_version',
    ],
    // Relaxation-only gentle squeeze: the unlock and the pain lock change together (03 ENG-061).
    ['gentle_unlocked_at', 'gentle_pain_lock'],
  ],
  safety_state: [['mode', 'reasons', 'since', 'set_by_run_id', 'strengthening_paused_reason']],
};

/**
 * Rows both devices create on their own with a different id but the same meaning. A newer incoming row replaces the
 * local one instead of adding a second (SYNC-014).
 */
export const NATURAL_KEYS: Partial<Record<TableName, string>> = {
  training_slot: 'slot_no',
  reminder: "kind || ':' || COALESCE(slot_no, '')",
};

export const SKIP_COLUMNS = ['hlc', 'created_at', 'updated_at'];
