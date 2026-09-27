// Mac camera for sync codes (07 SYNC-040, SYNC-042). Safari allows the camera on 127.0.0.1. Each frame is drawn to
// a canvas, decoded by jsQR in memory and dropped. Nothing is saved or sent anywhere.
import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { SYNC } from '../../content/en/sync';
import { Button, P } from '../../ui/kit';
import { radius } from '../../ui/theme';

type State = 'asking' | 'on' | 'denied' | 'none';

export function QrScanner({ onScan, size }: { onScan: (text: string) => void; size: number }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<State>('asking');
  const [attempt, setAttempt] = useState(0);
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    let last = '';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('none');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch (e) {
        const name = (e as { name?: string }).name;
        setState(name === 'NotFoundError' || name === 'OverconstrainedError' ? 'none' : 'denied');
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      setState('on');
      const v = video.current;
      if (!v) return;
      v.srcObject = stream;
      v.muted = true;
      v.playsInline = true;
      await v.play().catch(() => undefined);
      timer = setInterval(() => {
        if (!ctx || !v.videoWidth) return;
        // Scale down for speed; codes fill a good part of the view.
        const scale = Math.min(1, 800 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (hit?.data && hit.data !== last) {
          last = hit.data;
          cb.current(hit.data);
        }
      }, 90);
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [attempt]);

  if (state === 'denied' || state === 'none')
    return (
      <View style={{ gap: 12 }}>
        <P>{state === 'none' ? SYNC.cameraNone : SYNC.cameraDenied}</P>
        <Button label={SYNC.cameraAllow} kind="secondary" onPress={() => setAttempt((a) => a + 1)} />
      </View>
    );
  return (
    <View style={{ gap: 8 }}>
      <View style={{ width: size, height: size * 0.75, borderRadius: radius.lg, overflow: 'hidden', alignSelf: 'center', backgroundColor: '#000' }}>
        <video ref={video} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
      </View>
      <P small muted center>
        {SYNC.cameraHint}
      </P>
    </View>
  );
}
