// Shows one QR code, or loops through several (SYNC-043, SYNC-044). Always dark modules on white with a quiet zone,
// in light and dark themes, so every camera reads it.
import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useKeepAwake } from 'expo-keep-awake';
import { SYNC } from '../../content/en/sync';
import { radius } from '../../ui/theme';

function pathFor(text: string): { d: string; n: number } {
  const q = qrcode(0, 'L');
  q.addData(text, 'Alphanumeric');
  q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!q.isDark(r, c)) {
        c++;
        continue;
      }
      let w = 1;
      while (c + w < n && q.isDark(r, c + w)) w++;
      d += `M${c} ${r}h${w}v1h-${w}z`;
      c += w;
    }
  }
  return { d, n };
}

/** Frames per second for a looping sequence: fast enough to finish soon, slow enough for phone cameras. */
const FPS = 5;

export function QrCode({ frames, size }: { frames: string[]; size: number }) {
  useKeepAwake();
  const [i, setI] = useState(0);
  const paths = useMemo(() => frames.map(pathFor), [frames]);
  useEffect(() => {
    setI(0);
    if (frames.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % frames.length), 1000 / FPS);
    return () => clearInterval(t);
  }, [frames]);
  const p = paths[Math.min(i, paths.length - 1)];
  if (!p) return null;
  const quiet = 4;
  const box = p.n + quiet * 2;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={SYNC.codeLabel}
      style={{ width: size, height: size, backgroundColor: '#FFFFFF', borderRadius: radius.lg, overflow: 'hidden', alignSelf: 'center' }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${box} ${box}`}>
        <Rect x={0} y={0} width={box} height={box} fill="#FFFFFF" />
        <Path d={p.d} fill="#000000" transform={`translate(${quiet} ${quiet})`} />
      </Svg>
    </View>
  );
}
