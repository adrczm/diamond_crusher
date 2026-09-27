// Encrypted backup file (PRIV-030 to PRIV-033). Layout:
//   "DCBK" | version (1 byte) | header length (uint32 BE) | header JSON (cleartext, used as AAD) | ciphertext+tag
// Plaintext = gzip(UTF-8 JSON payload). KDF PBKDF2-HMAC-SHA256 600,000 iterations; AES-256-GCM.
import { gcm } from '@noble/ciphers/aes';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import { fromBase64, toBase64 } from './base64';

export const MAGIC = [0x44, 0x43, 0x42, 0x4b]; // "DCBK"
export const CONTAINER_VERSION = 1;
export const PBKDF2_ITERATIONS = 600_000;

export interface Header {
  kdf: 'pbkdf2-sha256';
  kdf_params: { iterations: number };
  salt: string;
  nonce: string;
  cipher: 'aes-256-gcm';
  compression: 'gzip';
}

export class BackupError extends Error {
  constructor(
    readonly code: 'not_a_backup' | 'unsupported_version' | 'wrong_passphrase_or_damaged' | 'invalid_content',
    message: string
  ) {
    super(message);
  }
}

export type RandomBytes = (n: number) => Uint8Array;

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number, onProgress?: (p: number) => void) {
  return pbkdf2Async(sha256, strToU8(passphrase.normalize('NFKC')), salt, {
    c: iterations,
    dkLen: 32,
    asyncTick: 20,
    ...(onProgress ? { onProgress } : {}),
  } as Parameters<typeof pbkdf2Async>[3]);
}

export async function encryptBackup(
  payload: unknown,
  passphrase: string,
  random: RandomBytes,
  opts: { iterations?: number; onProgress?: (p: number) => void } = {}
): Promise<Uint8Array> {
  const iterations = opts.iterations ?? PBKDF2_ITERATIONS;
  const salt = random(16);
  const nonce = random(12);
  const header: Header = {
    kdf: 'pbkdf2-sha256',
    kdf_params: { iterations },
    salt: toBase64(salt),
    nonce: toBase64(nonce),
    cipher: 'aes-256-gcm',
    compression: 'gzip',
  };
  const headerBytes = strToU8(JSON.stringify(header));
  const key = await deriveKey(passphrase, salt, iterations, opts.onProgress);
  const plain = gzipSync(strToU8(JSON.stringify(payload)), { mtime: 0 });
  const sealed = gcm(key, nonce, headerBytes).encrypt(plain);
  key.fill(0);
  const out = new Uint8Array(4 + 1 + 4 + headerBytes.length + sealed.length);
  out.set(MAGIC, 0);
  out[4] = CONTAINER_VERSION;
  new DataView(out.buffer).setUint32(5, headerBytes.length, false);
  out.set(headerBytes, 9);
  out.set(sealed, 9 + headerBytes.length);
  return out;
}

export function readHeader(file: Uint8Array): { header: Header; headerBytes: Uint8Array; body: Uint8Array } {
  if (file.length < 9 || MAGIC.some((b, i) => file[i] !== b)) throw new BackupError('not_a_backup', 'This file is not a Diamond Crusher backup.');
  if (file[4] !== CONTAINER_VERSION) throw new BackupError('unsupported_version', 'This backup was made by a newer version of the app.');
  const len = new DataView(file.buffer, file.byteOffset, file.byteLength).getUint32(5, false);
  if (9 + len > file.length) throw new BackupError('not_a_backup', 'This file is not a Diamond Crusher backup.');
  const headerBytes = file.slice(9, 9 + len);
  let header: Header;
  try {
    header = JSON.parse(strFromU8(headerBytes)) as Header;
  } catch {
    throw new BackupError('not_a_backup', 'This file is not a Diamond Crusher backup.');
  }
  if (header.kdf !== 'pbkdf2-sha256' || header.cipher !== 'aes-256-gcm') {
    throw new BackupError('unsupported_version', 'This backup uses a format this version can’t read.');
  }
  return { header, headerBytes, body: file.slice(9 + len) };
}

export async function decryptBackup(file: Uint8Array, passphrase: string, onProgress?: (p: number) => void): Promise<unknown> {
  const { header, headerBytes, body } = readHeader(file);
  const key = await deriveKey(passphrase, fromBase64(header.salt), header.kdf_params.iterations, onProgress);
  let plain: Uint8Array;
  try {
    plain = gcm(key, fromBase64(header.nonce), headerBytes).decrypt(body);
  } catch {
    throw new BackupError('wrong_passphrase_or_damaged', 'Wrong passphrase, or the file is damaged.');
  } finally {
    key.fill(0);
  }
  try {
    return JSON.parse(strFromU8(gunzipSync(plain)));
  } catch {
    throw new BackupError('invalid_content', 'The backup could not be read.');
  }
}

/** PRIV-031: 12+ characters, or 4+ words. */
export function passphraseOk(p: string): boolean {
  const words = p.trim().split(/\s+/).filter((w) => w.length > 0);
  return p.length >= 12 || words.length >= 4;
}

export function passphraseHint(p: string): 'too_short' | 'ok' | 'strong' {
  if (!passphraseOk(p)) return 'too_short';
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  return p.length >= 16 || classes >= 3 || p.trim().split(/\s+/).length >= 5 ? 'strong' : 'ok';
}
