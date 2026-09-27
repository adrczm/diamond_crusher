// Web build of the secure store (DATA-012). Values are encrypted with a non-extractable AES key that the browser
// keeps in IndexedDB: page scripts can use it but can't read it out, and the values are never stored in plain text.
// There is no fingerprint or Face ID here, so the auth-bound entries behave like plain ones (the app lock is phone only).
import { idb } from './idb';

const KEY = 'secure:wrap-key';
const PREFIX = 'secure:';

let wrapKey: Promise<CryptoKey> | null = null;

function getWrapKey(): Promise<CryptoKey> {
  if (!wrapKey) {
    wrapKey = (async () => {
      const existing = await idb.get<CryptoKey>(KEY);
      if (existing) return existing;
      const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await idb.set(KEY, k);
      return k;
    })().catch((e) => {
      wrapKey = null;
      throw e;
    });
  }
  return wrapKey;
}

export const secureStore = {
  async get(key: string, _auth?: { prompt: string }): Promise<string | null> {
    const v = await idb.get<{ iv: Uint8Array; data: ArrayBuffer }>(PREFIX + key);
    if (!v) return null;
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: v.iv as BufferSource }, await getWrapKey(), v.data);
    return new TextDecoder().decode(plain);
  },
  async set(key: string, value: string, _auth?: { prompt: string }): Promise<void> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getWrapKey(), new TextEncoder().encode(value));
    await idb.set(PREFIX + key, { iv, data });
  },
  async remove(key: string): Promise<void> {
    await idb.remove(PREFIX + key);
  },
  canUseAuth(): boolean {
    return false;
  },
};
