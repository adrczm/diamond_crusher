// Phone camera for sync codes (07 SYNC-040, SYNC-041). expo-camera decodes QR codes with ML Kit's bundled model.
// Frames stay inside the camera library: the app only receives the decoded text, and nothing is saved.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { View } from 'react-native';
import { SYNC } from '../../content/en/sync';
import { Button, P } from '../../ui/kit';
import { radius } from '../../ui/theme';

export function QrScanner({ onScan, size }: { onScan: (text: string) => void; size: number }) {
  const [perm, ask] = useCameraPermissions();
  const last = useRef('');
  if (!perm) return null;
  if (!perm.granted)
    return (
      <View style={{ gap: 12 }}>
        <P>{perm.canAskAgain ? SYNC.cameraAsk : SYNC.cameraDenied}</P>
        {perm.canAskAgain ? <Button label={SYNC.cameraAllow} onPress={() => void ask()} /> : null}
      </View>
    );
  return (
    <View style={{ gap: 8 }}>
      <View style={{ width: size, height: size, borderRadius: radius.lg, overflow: 'hidden', alignSelf: 'center' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={(r) => {
            if (!r.data || r.data === last.current) return;
            last.current = r.data;
            onScan(r.data);
          }}
        />
      </View>
      <P small muted center>
        {SYNC.cameraHint}
      </P>
    </View>
  );
}
