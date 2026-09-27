// Web build of the backup file hand-off: the browser downloads the file, and a file chooser opens one (PRIV-034, PRIV-035).
import { dbExistsFlag, webDbStore } from '../data/expoSql.web';

export const files = {
  async shareBackup(name: string, bytes: Uint8Array): Promise<void> {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/octet-stream' }));
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
  },

  pickBackup(): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.style.display = 'none';
      let settled = false;
      const done = (v: Uint8Array | null) => {
        if (settled) return;
        settled = true;
        input.remove();
        resolve(v);
      };
      input.onchange = async () => {
        const f = input.files?.[0];
        done(f ? new Uint8Array(await f.arrayBuffer()) : null);
      };
      input.addEventListener('cancel', () => done(null));
      document.body.appendChild(input);
      input.click();
    });
  },

  clearTemp(): void {
    // Nothing is written to temporary files on the web.
  },

  dbFileExists(name: string): boolean {
    return dbExistsFlag(name);
  },

  deleteDbFiles(name: string): void {
    void webDbStore.remove(name);
  },
};
