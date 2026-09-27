// What the QR codes carry (07 SYNC-021, SYNC-033, SYNC-043). Text uses only QR "alphanumeric" characters
// (A-Z, 2-7 for base32, digits and "/"), which scanners read reliably and which pack densely.
//   Pairing:      DCP1/<base32: key 32 | nonce 16 | node 4 | kind 1>
//   Confirmation: DCC1/<base32: node 4 | kind 1 | HMAC-SHA256(key, "confirm" | nonce | node A | node B)>
//   Changes:      DCS1/<transfer id>/<part>/<parts>/<base32 slice of: nonce 12 | AES-256-GCM(gzip(JSON))>
import { gcm } from '@noble/ciphers/aes';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import type { ChangeSet } from './changes';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function toBase32(bytes: Uint8Array): string {
  let out = '';
  let bits = 0;
  let value = 0;
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function fromBase32(text: string): Uint8Array {
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of text) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new CodeError('damaged');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export type Kind = 'phone' | 'computer';
export class CodeError extends Error {
  constructor(public reason: 'damaged' | 'not_ours' | 'other_pair' | 'wrong_step') {
    super(reason);
  }
}

const hexToBytes = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));
const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const kindByte = (k: Kind) => (k === 'phone' ? 1 : 2);
const byteKind = (b: number): Kind => (b === 1 ? 'phone' : 'computer');

export interface PairingOffer {
  key: Uint8Array;
  nonce: Uint8Array;
  node: string;
  kind: Kind;
}

export function encodePairing(o: PairingOffer): string {
  return `DCP1/${toBase32(concat(o.key, o.nonce, hexToBytes(o.node), new Uint8Array([kindByte(o.kind)])))}`;
}

export function decodePairing(text: string): PairingOffer {
  if (!text.startsWith('DCP1/')) throw new CodeError(text.startsWith('DC') ? 'wrong_step' : 'not_ours');
  const b = fromBase32(text.slice(5));
  if (b.length !== 53) throw new CodeError('damaged');
  return { key: b.slice(0, 32), nonce: b.slice(32, 48), node: bytesToHex(b.slice(48, 52)), kind: byteKind(b[52]) };
}

function confirmMac(key: Uint8Array, nonce: Uint8Array, offerNode: string, replyNode: string): Uint8Array {
  return hmac(sha256, key, concat(strToU8('confirm'), nonce, hexToBytes(offerNode), hexToBytes(replyNode)));
}

export function encodeConfirm(offer: PairingOffer, myNode: string, myKind: Kind): string {
  return `DCC1/${toBase32(concat(hexToBytes(myNode), new Uint8Array([kindByte(myKind)]), confirmMac(offer.key, offer.nonce, offer.node, myNode)))}`;
}

/** Checks the other device's confirmation against the pairing code this device showed. */
export function decodeConfirm(text: string, offer: PairingOffer): { node: string; kind: Kind } {
  if (!text.startsWith('DCC1/')) throw new CodeError(text.startsWith('DC') ? 'wrong_step' : 'not_ours');
  const b = fromBase32(text.slice(5));
  if (b.length !== 37) throw new CodeError('damaged');
  const node = bytesToHex(b.slice(0, 4));
  const expected = confirmMac(offer.key, offer.nonce, offer.node, node);
  const got = b.slice(5);
  let diff = 0;
  for (let i = 0; i < 32; i++) diff |= expected[i] ^ got[i];
  if (diff) throw new CodeError('other_pair');
  return { node, kind: byteKind(b[4]) };
}

/** Six digits both screens show, so the person can see the two devices hold the same key (SYNC-020). */
export function checkCode(key: Uint8Array, nonce: Uint8Array): string {
  const m = hmac(sha256, key, concat(strToU8('check'), nonce));
  const n = ((m[0] << 24) >>> 0) + (m[1] << 16) + (m[2] << 8) + m[3];
  return String(n % 1_000_000).padStart(6, '0');
}

const aad = (from: string, to: string) => strToU8(`DCS1|${from}|${to}`);

export function sealChanges(cs: ChangeSet, key: Uint8Array, to: string, nonce: Uint8Array): Uint8Array {
  const plain = gzipSync(strToU8(JSON.stringify(cs)), { level: 9, mtime: 0 });
  return concat(nonce, gcm(key, nonce, aad(cs.from, to)).encrypt(plain));
}

export function openChanges(sealed: Uint8Array, key: Uint8Array, from: string, me: string): ChangeSet {
  if (sealed.length < 12 + 16) throw new CodeError('damaged');
  let plain: Uint8Array;
  try {
    plain = gcm(key, sealed.slice(0, 12), aad(from, me)).decrypt(sealed.slice(12));
  } catch {
    throw new CodeError('other_pair');
  }
  const cs = JSON.parse(strFromU8(gunzipSync(plain))) as ChangeSet;
  if (cs.v !== 1 || cs.from !== from) throw new CodeError('damaged');
  return cs;
}

/** Characters of base32 per QR frame (about 440 bytes). Small enough for a quick, reliable read (SYNC-043). */
export const FRAME_CHARS = 700;

export function toFrames(sealed: Uint8Array, transferId: string): string[] {
  const text = toBase32(sealed);
  const n = Math.max(1, Math.ceil(text.length / FRAME_CHARS));
  return Array.from({ length: n }, (_, i) => `DCS1/${transferId}/${i + 1}/${n}/${text.slice(i * FRAME_CHARS, (i + 1) * FRAME_CHARS)}`);
}

export interface Frame {
  id: string;
  part: number;
  parts: number;
  data: string;
}

export function parseFrame(text: string): Frame {
  const m = /^DCS1\/([A-Z2-7]{4})\/(\d+)\/(\d+)\/([A-Z2-7]*)$/.exec(text.trim());
  if (!m) throw new CodeError(text.startsWith('DC') ? 'wrong_step' : 'not_ours');
  const part = Number(m[2]);
  const parts = Number(m[3]);
  if (part < 1 || part > parts || parts > 2000) throw new CodeError('damaged');
  return { id: m[1], part, parts, data: m[4] };
}

/** Collects frames in any order; repeats and misses are fine because the sender loops (SYNC-043). */
export class FrameCollector {
  private id: string | null = null;
  private parts = 0;
  private got = new Map<number, string>();

  /** Returns true when this frame was new. */
  add(f: Frame): boolean {
    if (this.id !== f.id) {
      this.id = f.id;
      this.parts = f.parts;
      this.got = new Map();
    }
    if (this.got.has(f.part)) return false;
    this.got.set(f.part, f.data);
    return true;
  }

  get progress(): { have: number; total: number } {
    return { have: this.got.size, total: this.parts };
  }

  get complete(): boolean {
    return this.parts > 0 && this.got.size === this.parts;
  }

  bytes(): Uint8Array {
    let text = '';
    for (let i = 1; i <= this.parts; i++) text += this.got.get(i) ?? '';
    return fromBase32(text);
  }
}

export { bytesToHex, hexToBytes };
