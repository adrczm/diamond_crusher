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
): Promise<void> {
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
  await setLastExport(db, now.toISOString());
  await logDataOp(db, 'exported');
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
