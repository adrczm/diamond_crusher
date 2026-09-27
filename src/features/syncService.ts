// Pairing and syncing a phone and a Mac with QR codes (07 §11).
import { Platform } from 'react-native';
import { applyChangeSet, buildChangeSet, changeCount, getPeer, localNode, type SyncPeer } from '../data/sync/changes';
import {
  bytesToHex,
  checkCode,
  decodeConfirm,
  decodePairing,
  encodeConfirm,
  encodePairing,
  hexToBytes,
  openChanges,
  sealChanges,
  toBase32,
  toFrames,
  type Kind,
  type PairingOffer,
} from '../data/sync/codes';
import type { SqlDb } from '../data/sql';
import { randomBytes } from '../platform/random';
import { reconcileReminders } from './reminderService';
import { todayLocal } from './safetyService';
import { evaluateProgression } from './trainingService';

export const MY_KIND: Kind = Platform.OS === 'web' ? 'computer' : 'phone';

/** Above this, the backup file is the faster way (SYNC-034). */
export const LARGE_SYNC_BYTES = 150_000;

async function savePeer(db: SqlDb, node: string, kind: Kind, key: Uint8Array): Promise<void> {
  await db.run(
    `INSERT OR REPLACE INTO sync_peer (id, peer_node, peer_kind, sync_key, paired_at, last_sent_hlc, last_received_hlc, last_sync_at)
     VALUES (1, ?, ?, ?, ?, '', '', NULL)`,
    [node, kind, bytesToHex(key), new Date().toISOString()]
  );
}

/** Step 1 on the device that shows the pairing code. */
export async function startPairing(db: SqlDb): Promise<{ offer: PairingOffer; code: string }> {
  const offer: PairingOffer = { key: randomBytes(32), nonce: randomBytes(16), node: await localNode(db), kind: MY_KIND };
  return { offer, code: encodePairing(offer) };
}

/** Step 2 on the device that scans it: pairs, and returns the reply code to show and the check number. */
export async function acceptPairing(db: SqlDb, scanned: string): Promise<{ reply: string; check: string; peerKind: Kind }> {
  const offer = decodePairing(scanned);
  const me = await localNode(db);
  await savePeer(db, offer.node, offer.kind, offer.key);
  return { reply: encodeConfirm(offer, me, MY_KIND), check: checkCode(offer.key, offer.nonce), peerKind: offer.kind };
}

/** Step 3 back on the first device: checks the reply, pairs, and returns the check number. */
export async function finishPairing(db: SqlDb, offer: PairingOffer, scanned: string): Promise<{ check: string; peerKind: Kind }> {
  const peer = decodeConfirm(scanned, offer);
  await savePeer(db, peer.node, peer.kind, offer.key);
  return { check: checkCode(offer.key, offer.nonce), peerKind: peer.kind };
}

export async function unpair(db: SqlDb): Promise<void> {
  await db.run('DELETE FROM sync_peer');
}

export interface SyncStatus {
  peer: SyncPeer | null;
  waiting: number;
}

export async function syncStatus(db: SqlDb): Promise<SyncStatus> {
  const peer = await getPeer(db);
  if (!peer) return { peer, waiting: 0 };
  return { peer, waiting: changeCount(await buildChangeSet(db)) };
}

/** The QR frames that carry this device's new changes (SYNC-030, SYNC-031). */
export async function outgoingFrames(db: SqlDb, everything = false): Promise<{ frames: string[]; changes: number; bytes: number }> {
  const peer = await getPeer(db);
  if (!peer) throw new Error('not paired');
  const cs = await buildChangeSet(db, everything ? '' : undefined);
  const sealed = sealChanges(cs, hexToBytes(peer.sync_key), peer.peer_node, randomBytes(12));
  const id = toBase32(randomBytes(3)).slice(0, 4);
  return { frames: toFrames(sealed, id), changes: changeCount(cs), bytes: sealed.length };
}

/** Opens and applies the other device's changes, then refreshes what is worked out from them (SYNC-035). */
export async function receiveChanges(db: SqlDb, sealed: Uint8Array): Promise<{ applied: number; clockWarning: boolean }> {
  const peer = await getPeer(db);
  if (!peer) throw new Error('not paired');
  const cs = openChanges(sealed, hexToBytes(peer.sync_key), peer.peer_node, await localNode(db));
  const res = await applyChangeSet(db, cs);
  if (res.applied) {
    try {
      await evaluateProgression(db, todayLocal());
    } catch (e) {
      console.warn('sync: progression', e);
    }
    await reconcileReminders(db);
  }
  return { applied: res.applied, clockWarning: res.clockWarning };
}
