// Encrypted backup file export and import (07 PRIV-030 to PRIV-037).
import { decryptBackup, encryptBackup } from '../data/backup/container';
import { buildPayload, importMerge, importReplace, preview, validatePayload, type Payload, type Preview } from '../data/backup/exportImport';
import { logDataOp, setLastExport } from '../data/repositories/misc';
import type { SqlDb } from '../data/sql';
import { applyImportedBootstrap, type Bootstrap } from '../data/vault';
import { files } from '../platform/files';
import { randomBytes } from '../platform/random';
import { withoutRelock } from './app';

export async function exportBackup(
  db: SqlDb,
  boot: Bootstrap,
  appVersion: string,
  passphrase: string,
  onProgress?: (p: number) => void
): Promise<string> {
  const now = new Date();
  const payload = await buildPayload(db, {
    appVersion,
    installId: boot.install_id,
    lockEnabled: boot.lock_enabled,
    lockTimeoutS: boot.lock_timeout_s,
    now,
  });
  const bytes = await encryptBackup(payload, passphrase, randomBytes, { onProgress });
  const stamp = now.toISOString().slice(0, 10);
  await withoutRelock(() => files.shareBackup(`diamond-crusher-${stamp}.dcbk`, bytes));
  return now.toISOString();
}

/**
 * Counts a backup only after the person says the file saved (DS-E5). A closed share sheet or a blocked download returns
 * normally, so the share call alone cannot tell.
 */
export async function recordExport(db: SqlDb, at: string): Promise<void> {
  await setLastExport(db, at);
  await logDataOp(db, 'exported');
}

/** What this device holds now, in the same shape as a backup preview, so the two can be compared (DS-E4). */
export async function devicePreview(db: SqlDb): Promise<Preview> {
  const n = async (t: string) => (await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`))?.n ?? 0;
  const span = await db.get<{ a: string | null; b: string | null }>(
    `SELECT MIN(d) AS a, MAX(d) AS b FROM (SELECT local_date AS d FROM session UNION ALL SELECT local_date FROM self_check UNION ALL SELECT local_date FROM event)`
  );
  return {
    from: span?.a ?? null,
    to: span?.b ?? null,
    sessions: await n('session'),
    selfChecks: await n('self_check'),
    questionnaires: await n('questionnaire_response'),
    events: await n('event'),
    exportedAt: '',
  };
}

/** Plain words for a backup error (DS-P2); never the raw system message. */
export function backupErrorText(e: unknown, texts: Record<string, string>): string {
  const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : '';
  return texts[code] ?? texts.other;
}

export async function pickBackupFile(): Promise<Uint8Array | null> {
  return withoutRelock(() => files.pickBackup());
}

export async function openBackup(file: Uint8Array, passphrase: string, onProgress?: (p: number) => void): Promise<{ payload: Payload; preview: Preview }> {
  const obj = await decryptBackup(file, passphrase, onProgress);
  const payload = validatePayload(obj);
  return { payload, preview: preview(payload) };
}

export async function applyImport(
  db: SqlDb,
  boot: Bootstrap,
  payload: Payload,
  how: 'replace' | 'merge',
  keep: 'this_phone' | 'backup' = 'this_phone'
): Promise<Bootstrap> {
  if (how === 'replace') await importReplace(db, payload);
  else await importMerge(db, payload, keep);
  await logDataOp(db, how === 'replace' ? 'imported_replace' : 'imported_merge');
  if (how === 'replace' || keep === 'backup') return applyImportedBootstrap(db, boot, payload.bootstrap);
  return boot;
}
