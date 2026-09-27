// Wording for sync between the phone and the Mac (07 §11). Short sentences, one instruction per sentence.
import type { Kind } from '../../data/sync/codes';

const other = (k: Kind | null) => (k === 'phone' ? 'phone' : k === 'computer' ? 'Mac' : 'other device');

export const SYNC = {
  title: 'Sync',
  entryTitle: 'Sync with your other device',
  entryBody: 'Keep your phone and your Mac in step. Codes on the screen carry your data. No internet. No cloud.',
  entryButton: 'Set up sync',
  entryButtonPaired: 'Sync now',

  introTitle: 'Two devices, one record',
  intro: 'Show a code on one device. Scan it with the other. Your sessions, checks, settings and progress then match on both.',
  privacy: 'The codes are encrypted with a key that only your two devices have. The camera reads codes only. It saves no photos.',
  howPair: 'First, pair the two devices. You do this one time.',
  pairShow: 'Show a pairing code',
  pairScan: 'Scan a pairing code',
  pairShowTitle: 'Pair: step 1 of 3',
  pairShowBody: (k: Kind | null) => `On your ${other(k)}, open Sync and select “Scan a pairing code”. Point it at this code.`,
  pairShowNext: 'Next: scan the reply',
  pairReplyScanTitle: 'Pair: step 3 of 3',
  pairReplyScanBody: 'Your other device now shows a code. Point this camera at it.',
  pairScanTitle: 'Pair: step 2 of 3',
  pairScanBody: 'Point this camera at the pairing code on your other device.',
  pairReplyTitle: 'Pair: step 2 of 3',
  pairReplyBody: 'Point the other device at this code. Then compare the numbers.',
  checkTitle: 'Do the numbers match?',
  checkBody: 'Both screens show a 6-digit number. If they are the same, the pairing is safe.',
  match: 'They match',
  noMatch: 'They do not match',
  noMatchDone: 'Pairing stopped. Start again on both devices.',
  paired: (k: Kind | null) => `Paired with your ${other(k)}. Now sync to share your data.`,

  statusTitle: (k: Kind | null) => `Paired with your ${other(k)}`,
  lastSync: (d: string | null) => (d ? `Last sync: ${d}` : 'Not synced yet'),
  waiting: (n: number) => (n === 0 ? 'Nothing new to send.' : n === 1 ? '1 change is ready to send.' : `${n} changes are ready to send.`),
  howSync: 'One device shows its changes. The other scans them. Then swap.',
  send: 'Show my changes',
  receive: 'Scan changes',
  sendEverything: 'Send all my data again',
  unpair: 'Unpair',
  unpairConfirm: 'Unpair this device? Do the same on your other device. Your data stays on both.',
  unpairDone: 'Unpaired. Your data stays on this device.',

  sendTitle: 'Show my changes',
  sendBody: (k: Kind | null, parts: number) =>
    parts > 1
      ? `Hold your ${other(k)} camera up to this screen. The codes change fast. Keep still until the other device says done.`
      : `Hold your ${other(k)} camera up to this code. Keep still until the other device says done.`,
  sendCount: (n: number) => (n === 0 ? 'No new changes. The code still tells the other device what arrived.' : n === 1 ? '1 change' : `${n} changes`),
  sendLarge: 'This is a lot of data for codes. A backup file can be faster.',
  sendNext: 'Next: scan theirs',
  sendDone: 'Done',

  receiveTitle: 'Scan changes',
  receiveBody: (k: Kind | null) => `On your ${other(k)}, select “Show my changes”. Point this camera at the code.`,
  progress: (have: number, total: number) => `${have} of ${total} codes read`,
  receivedTitle: 'Synced',
  received: (n: number) => (n === 0 ? 'You were already up to date.' : n === 1 ? '1 update added.' : `${n} updates added.`),
  receivedNext: 'Next: show my changes',
  allDone: 'Both devices now match. Nice work.',
  clockWarning: 'The other device’s clock looks wrong. Check its date and time.',

  cameraAsk: 'Sync needs the camera to read codes. It saves no photos.',
  cameraAllow: 'Allow camera',
  cameraDenied: 'Camera access is off. Turn it on in your settings, or use a backup file.',
  cameraNone: 'No camera found. Connect a webcam, or use a backup file.',
  cameraHint: 'Camera on. Reading codes only.',

  errors: {
    damaged: 'That code did not read well. Hold still and try again.',
    not_ours: 'That is not a Diamond Crusher code.',
    other_pair: 'That code is from a different pairing. Pair these two devices again.',
    wrong_step: 'That code is for a different step. Check which screen the other device shows.',
    not_paired: 'Pair the two devices first.',
  },
  cancel: 'Cancel',
  back: 'Back',
};
