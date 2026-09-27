// Backup file hand-off: app-private temp file, OS share sheet, and the document picker (PRIV-034, PRIV-035).
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';

const EXPORT_DIR = 'dc-export';

function exportDir(): Directory {
  const d = new Directory(Paths.cache, EXPORT_DIR);
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

export const files = {
  async shareBackup(name: string, bytes: Uint8Array): Promise<void> {
    const f = new File(exportDir(), name);
    if (f.exists) f.delete();
    f.create();
    f.write(bytes);
    try {
      await Sharing.shareAsync(f.uri, { mimeType: 'application/octet-stream', dialogTitle: 'Save your backup file' });
    } finally {
      if (f.exists) f.delete();
    }
  },

  async pickBackup(): Promise<Uint8Array | null> {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: '*/*' });
    if (res.canceled || !res.assets?.length) return null;
    const f = new File(res.assets[0].uri);
    try {
      return await f.bytes();
    } finally {
      try {
        if (f.exists) f.delete();
      } catch {
        // The picked copy may be read-only; the cache is cleared by the OS.
      }
    }
  },

  /** PRIV-034: leftover temp exports are removed on start. */
  clearTemp(): void {
    const d = new Directory(Paths.cache, EXPORT_DIR);
    if (d.exists) d.delete();
  },

  dbFileExists(name: string): boolean {
    const dir: string = SQLite.defaultDatabaseDirectory;
    return new File(dir.startsWith('file://') ? dir : `file://${dir}`, name).exists;
  },

  /** Removes the database, its WAL/SHM files and any pre-migration copies (PRIV-050). */
  deleteDbFiles(name: string): void {
    const dirPath: string = SQLite.defaultDatabaseDirectory;
    const dir = new Directory(dirPath.startsWith('file://') ? dirPath : `file://${dirPath}`);
    if (!dir.exists) return;
    for (const entry of dir.list()) {
      if (entry instanceof File && entry.name.startsWith(name)) entry.delete();
    }
  },
};
