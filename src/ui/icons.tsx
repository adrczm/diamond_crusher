// Line icons for the desktop sidebar and toolbar (24px grid, 2px stroke, round joins; drawn in the Polaris style).
import Svg, { Circle, Path, Polygon, Polyline, Rect } from 'react-native-svg';

export type IconName =
  | 'home'
  | 'library'
  | 'progress'
  | 'log'
  | 'check'
  | 'reminders'
  | 'settings'
  | 'data'
  | 'sun'
  | 'moon'
  | 'auto'
  | 'play'
  | 'back'
  | 'keyboard'
  | 'done';

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  const p = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  let body: React.ReactNode;
  switch (name) {
    case 'home':
      body = (
        <>
          <Circle cx={12} cy={12} r={9} {...p} />
          <Circle cx={12} cy={12} r={5} {...p} />
          <Circle cx={12} cy={12} r={1.5} fill={color} />
        </>
      );
      break;
    case 'library':
      body = (
        <>
          <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" {...p} />
          <Path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" {...p} />
        </>
      );
      break;
    case 'progress':
      body = (
        <>
          <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17" {...p} />
          <Polyline points="16 7 22 7 22 13" {...p} />
        </>
      );
      break;
    case 'log':
      body = (
        <>
          <Path d="M12 20h9" {...p} />
          <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" {...p} />
        </>
      );
      break;
    case 'check':
      body = (
        <>
          <Rect x={8} y={2} width={8} height={4} rx={1} {...p} />
          <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" {...p} />
          <Path d="m9 14 2 2 4-4" {...p} />
        </>
      );
      break;
    case 'reminders':
      body = (
        <>
          <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" {...p} />
          <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" {...p} />
        </>
      );
      break;
    case 'settings':
      body = (
        <>
          <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" {...p} />
        </>
      );
      break;
    case 'data':
      body = (
        <>
          <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" {...p} />
          <Polyline points="7 10 12 15 17 10" {...p} />
          <Path d="M12 15V3" {...p} />
        </>
      );
      break;
    case 'sun':
      body = (
        <>
          <Circle cx={12} cy={12} r={4} {...p} />
          <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" {...p} />
        </>
      );
      break;
    case 'moon':
      body = <Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" {...p} />;
      break;
    case 'auto':
      body = (
        <>
          <Circle cx={12} cy={12} r={9} {...p} />
          <Path d="M12 3a9 9 0 0 1 0 18z" fill={color} />
        </>
      );
      break;
    case 'play':
      body = <Polygon points="7 4 20 12 7 20 7 4" fill={color} stroke={color} strokeWidth={2} strokeLinejoin="round" />;
      break;
    case 'back':
      body = <Path d="m15 18-6-6 6-6" {...p} />;
      break;
    case 'keyboard':
      body = (
        <>
          <Rect x={2} y={5} width={20} height={14} rx={2} {...p} />
          <Path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M8 16h8" {...p} />
        </>
      );
      break;
    case 'done':
      body = <Polyline points="20 6 9 17 4 12" {...p} />;
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {body}
    </Svg>
  );
}
