// Minimal IndexedDB key-value store for the web build: one database, one object store.
const DB = 'diamond-crusher';
const STORE = 'kv';

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        opening = null;
        reject(req.error);
      };
    });
  }
  return opening;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const idb = {
  async get<T>(key: string): Promise<T | undefined> {
    return (await tx<T>('readonly', (s) => s.get(key) as IDBRequest<T>)) ?? undefined;
  },
  async set(key: string, value: unknown): Promise<void> {
    await tx('readwrite', (s) => void s.put(value, key));
  },
  async remove(key: string): Promise<void> {
    await tx('readwrite', (s) => void s.delete(key));
  },
  /** Asks the browser not to evict this site's data under storage pressure (Safari honours this for Dock web apps). */
  async persist(): Promise<void> {
    try {
      await navigator.storage?.persist?.();
    } catch {
      // Not supported: data stays, but the browser may evict it if space runs out.
    }
  },
};
