// Sync with your other device by QR codes (07 §11): pairing, then "show my changes" and "scan changes".
import { useCallback, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { SYNC } from '../src/content/en/sync';
import { CodeError, FrameCollector, parseFrame, type Kind, type PairingOffer } from '../src/data/sync/codes';
import { formatShort, toLocalDate } from '../src/domain/dates';
import { useApp, useLoad } from '../src/features/app';
import { QrCode } from '../src/features/sync/QrCode';
import { QrScanner } from '../src/features/sync/QrScanner';
import {
  acceptPairing,
  finishPairing,
  LARGE_SYNC_BYTES,
  outgoingFrames,
  receiveChanges,
  startPairing,
  syncStatus,
  unpair,
} from '../src/features/syncService';
import { Alert } from '../src/platform/dialog';
import { Banner, Button, Card, H2, Label, Loading, P, Screen } from '../src/ui/kit';

type Step =
  | { kind: 'home' }
  | { kind: 'pairShow'; offer: PairingOffer; code: string }
  | { kind: 'pairScanReply'; offer: PairingOffer }
  | { kind: 'pairScan' }
  | { kind: 'pairReply'; reply: string; check: string; peerKind: Kind }
  | { kind: 'pairCheck'; check: string; peerKind: Kind }
  | { kind: 'send'; frames: string[]; changes: number; bytes: number }
  | { kind: 'receive' }
  | { kind: 'received'; applied: number; clockWarning: boolean };

function errorText(e: unknown): string {
  if (e instanceof CodeError) return SYNC.errors[e.reason];
  if (e instanceof Error && e.message === 'not paired') return SYNC.errors.not_paired;
  return SYNC.errors.damaged;
}

export default function SyncScreen() {
  const { db, bump } = useApp();
  const { data, reload } = useLoad((d) => syncStatus(d));
  const [step, setStep] = useState<Step>({ kind: 'home' });
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ have: number; total: number } | null>(null);
  // Which half of a sync round is done, so the screen can offer the other half next (SYNC-030).
  const round = useRef({ sent: false, received: false });
  const busy = useRef(false);
  const collector = useRef(new FrameCollector());
  const { width, height } = useWindowDimensions();
  const size = Math.min(width - 48, height * 0.55, 440);

  const go = (s: Step) => {
    setError(null);
    setProgress(null);
    setStep(s);
  };
  const home = (message: string | null = null) => {
    round.current = { sent: false, received: false };
    setNote(message);
    go({ kind: 'home' });
    reload();
    bump();
  };

  const showChanges = async (everything = false) => {
    try {
      const out = await outgoingFrames(db, everything);
      round.current.sent = true;
      go({ kind: 'send', ...out });
    } catch (e) {
      setError(errorText(e));
    }
  };
  const scanChanges = () => {
    collector.current = new FrameCollector();
    go({ kind: 'receive' });
  };

  const onScan = useCallback(
    async (text: string) => {
      if (busy.current) return;
      busy.current = true;
      try {
        if (step.kind === 'pairScan') {
          const r = await acceptPairing(db, text);
          go({ kind: 'pairReply', ...r });
        } else if (step.kind === 'pairScanReply') {
          const r = await finishPairing(db, step.offer, text);
          go({ kind: 'pairCheck', ...r });
        } else if (step.kind === 'receive') {
          const c = collector.current;
          c.add(parseFrame(text));
          setProgress(c.progress);
          setError(null);
          if (c.complete) {
            const r = await receiveChanges(db, c.bytes());
            round.current.received = true;
            go({ kind: 'received', ...r });
            bump();
          }
        }
      } catch (e) {
        setError(errorText(e));
      } finally {
        busy.current = false;
      }
    },
    [step, db, bump]
  );

  if (!data) return <Loading />;
  const peer = data.peer;
  const peerKind = (peer?.peer_kind ?? null) as Kind | null;
  const err = error ? <Banner text={error} /> : null;

  if (step.kind === 'pairShow')
    return (
      <Screen title={SYNC.title}>
        <H2>{SYNC.pairShowTitle}</H2>
        <P>{SYNC.pairShowBody(null)}</P>
        <QrCode frames={[step.code]} size={size} />
        <Button label={SYNC.pairShowNext} onPress={() => go({ kind: 'pairScanReply', offer: step.offer })} />
        <Button label={SYNC.cancel} kind="quiet" onPress={() => home()} />
      </Screen>
    );
  if (step.kind === 'pairScan' || step.kind === 'pairScanReply')
    return (
      <Screen title={SYNC.title}>
        <H2>{step.kind === 'pairScan' ? SYNC.pairScanTitle : SYNC.pairReplyScanTitle}</H2>
        <P>{step.kind === 'pairScan' ? SYNC.pairScanBody : SYNC.pairReplyScanBody}</P>
        {err}
        <QrScanner onScan={onScan} size={size} />
        <Button label={SYNC.cancel} kind="quiet" onPress={() => home()} />
      </Screen>
    );
  if (step.kind === 'pairReply' || step.kind === 'pairCheck') {
    const finish = async (ok: boolean) => {
      if (!ok) await unpair(db);
      home(ok ? SYNC.paired(step.peerKind) : SYNC.noMatchDone);
    };
    return (
      <Screen title={SYNC.title}>
        {step.kind === 'pairReply' ? (
          <>
            <H2>{SYNC.pairReplyTitle}</H2>
            <P>{SYNC.pairReplyBody}</P>
            <QrCode frames={[step.reply]} size={size} />
          </>
        ) : null}
        <Card tone="soft">
          <Label>{SYNC.checkTitle}</Label>
          <P>{SYNC.checkBody}</P>
          <H2>{`${step.check.slice(0, 3)} ${step.check.slice(3)}`}</H2>
        </Card>
        <Button label={SYNC.match} onPress={() => void finish(true)} />
        <Button label={SYNC.noMatch} kind="secondary" onPress={() => void finish(false)} />
      </Screen>
    );
  }
  if (step.kind === 'send')
    return (
      <Screen title={SYNC.title}>
        <H2>{SYNC.sendTitle}</H2>
        <P>{SYNC.sendBody(peerKind, step.frames.length)}</P>
        {step.bytes > LARGE_SYNC_BYTES ? <Banner text={SYNC.sendLarge} /> : null}
        <QrCode frames={step.frames} size={size} />
        <P small muted center>
          {SYNC.sendCount(step.changes)}
        </P>
        {round.current.received ? (
          <Button label={SYNC.sendDone} onPress={() => home(SYNC.allDone)} />
        ) : (
          <>
            <Button label={SYNC.sendNext} onPress={scanChanges} />
            <Button label={SYNC.sendDone} kind="quiet" onPress={() => home()} />
          </>
        )}
      </Screen>
    );
  if (step.kind === 'receive')
    return (
      <Screen title={SYNC.title}>
        <H2>{SYNC.receiveTitle}</H2>
        <P>{SYNC.receiveBody(peerKind)}</P>
        {err}
        <QrScanner onScan={onScan} size={size} />
        {progress && progress.total > 1 ? (
          <P center>{SYNC.progress(progress.have, progress.total)}</P>
        ) : null}
        <Button label={SYNC.cancel} kind="quiet" onPress={() => home()} />
      </Screen>
    );
  if (step.kind === 'received')
    return (
      <Screen title={SYNC.title}>
        <H2>{SYNC.receivedTitle}</H2>
        <P>{SYNC.received(step.applied)}</P>
        {step.clockWarning ? <Banner text={SYNC.clockWarning} /> : null}
        {round.current.sent ? (
          <Button label={SYNC.sendDone} onPress={() => home(SYNC.allDone)} />
        ) : (
          <>
            <Button label={SYNC.receivedNext} onPress={() => void showChanges()} />
            <Button label={SYNC.sendDone} kind="quiet" onPress={() => home()} />
          </>
        )}
      </Screen>
    );

  // Home
  const last = peer?.last_sync_at ? formatShort(toLocalDate(new Date(peer.last_sync_at))) : null;
  return (
    <Screen title={SYNC.title}>
      {note ? <Banner tone="soft" text={note} /> : null}
      {err}
      {peer ? (
        <>
          <Card>
            <Label>{SYNC.statusTitle(peerKind)}</Label>
            <P>{SYNC.lastSync(last)}</P>
            <P muted>{SYNC.waiting(data.waiting)}</P>
            <P small muted>
              {SYNC.howSync}
            </P>
            <Button label={SYNC.send} onPress={() => void showChanges()} />
            <Button label={SYNC.receive} kind="secondary" onPress={scanChanges} />
          </Card>
          <View>
            <Button label={SYNC.sendEverything} kind="quiet" onPress={() => void showChanges(true)} />
            <Button
              label={SYNC.unpair}
              kind="quiet"
              onPress={() =>
                Alert.alert(SYNC.unpair, SYNC.unpairConfirm, [
                  { text: SYNC.cancel, style: 'cancel' },
                  {
                    text: SYNC.unpair,
                    style: 'destructive',
                    onPress: async () => {
                      await unpair(db);
                      home(SYNC.unpairDone);
                    },
                  },
                ])
              }
            />
          </View>
        </>
      ) : (
        <Card>
          <Label>{SYNC.introTitle}</Label>
          <P>{SYNC.intro}</P>
          <P muted>{SYNC.howPair}</P>
          <Button
            label={SYNC.pairShow}
            onPress={async () => {
              const s = await startPairing(db);
              go({ kind: 'pairShow', ...s });
            }}
          />
          <Button label={SYNC.pairScan} kind="secondary" onPress={() => go({ kind: 'pairScan' })} />
        </Card>
      )}
      <P small muted>
        {SYNC.privacy}
      </P>
    </Screen>
  );
}
