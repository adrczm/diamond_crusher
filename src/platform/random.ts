// Random bytes from the platform CSPRNG (DATA-011). Also gives libraries a crypto.getRandomValues.
import * as Crypto from 'expo-crypto';

export function randomBytes(n: number): Uint8Array {
  return Crypto.getRandomBytes(n);
}

export function installCryptoPolyfill() {
  const g = globalThis as { crypto?: { getRandomValues?: unknown; randomUUID?: unknown } };
  if (!g.crypto) (g as { crypto: object }).crypto = {};
  const c = g.crypto as { getRandomValues?: unknown; randomUUID?: unknown };
  if (!c.getRandomValues) c.getRandomValues = Crypto.getRandomValues;
  if (!c.randomUUID) c.randomUUID = Crypto.randomUUID;
}

export function randomHex(n: number): string {
  return Array.from(randomBytes(n), (b) => b.toString(16).padStart(2, '0')).join('');
}
