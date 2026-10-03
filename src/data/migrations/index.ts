import type { SqlDb } from '../sql';
import * as m0001 from './0001_init';
import * as m0002 from './0002_sync';
import * as m0003 from './0003_round2';

export interface Migration {
  version: number;
  name: string;
  up(db: SqlDb): Promise<void>;
}

/** Forward-only, numbered migrations (DATA-201). */
export const MIGRATIONS: Migration[] = [
  { version: 1, name: '0001_init', up: m0001.up },
  { version: 2, name: '0002_sync', up: m0002.up },
  { version: 3, name: '0003_round2', up: m0003.up },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/** Tables in dependency order (parents first), used by export, import and delete-all. */
export const TABLES = [
  'meta',
  'profile',
  'profile_goal',
  'settings',
  'screening_run',
  'screening_answer',
  'safety_state',
  'safety_flag',
  'learn_attempt',
  'content_view',
  'programme_state',
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
  'reminder_action',
  'milestone',
  'functional_habit_day',
  'weekly_summary',
  'message_event',
  'data_op_log',
] as const;

export type TableName = (typeof TABLES)[number];

/** Primary key columns per table, for merge on import (PRIV-036). */
export const PRIMARY_KEYS: Record<TableName, string[]> = {
  meta: ['id'],
  profile: ['id'],
  profile_goal: ['goal'],
  settings: ['id'],
  screening_run: ['id'],
  screening_answer: ['run_id', 'question_key'],
  safety_state: ['id'],
  safety_flag: ['id'],
  learn_attempt: ['id'],
  content_view: ['content_key', 'content_version'],
  programme_state: ['id'],
  level_change: ['id'],
  training_slot: ['id'],
  session: ['id'],
  exercise_set: ['session_id', 'seq'],
  session_log: ['session_id'],
  self_check: ['id'],
  event: ['id'],
  context_flag: ['id'],
  scheduled_check: ['id'],
  questionnaire_response: ['id'],
  questionnaire_answer: ['response_id', 'item_key'],
  reminder: ['id'],
  reminder_action: ['id'],
  milestone: ['key'],
  functional_habit_day: ['local_date'],
  weekly_summary: ['week_start'],
  message_event: ['id'],
  data_op_log: ['id'],
};

export const SINGLETONS: TableName[] = ['meta', 'profile', 'settings', 'safety_state', 'programme_state'];
