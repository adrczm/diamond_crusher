// Tones, voice and vibration for sessions (ENG-011, ARCH-032). Offline only: bundled tones and OS voices.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { Vibration } from 'react-native';
import type { AudioMode } from '../domain/types';

export type Cue = 'squeeze' | 'release' | 'tick' | 'done';

const SOURCES: Record<Cue, number> = {
  squeeze: require('../../assets/sounds/squeeze.wav'),
  release: require('../../assets/sounds/release.wav'),
  tick: require('../../assets/sounds/tick.wav'),
  done: require('../../assets/sounds/done.wav'),
};

const players: Partial<Record<Cue, AudioPlayer>> = {};
let ready = false;

async function ensure() {
  if (ready) return;
  try {
    await setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' });
  } catch {
    // Older OS versions: fall back to defaults.
  }
  for (const k of Object.keys(SOURCES) as Cue[]) players[k] = createAudioPlayer(SOURCES[k]);
  ready = true;
}

const VIBRATION: Record<Cue, number[]> = {
  squeeze: [0, 250],
  release: [0, 90, 80, 90],
  tick: [0, 20],
  done: [0, 120, 80, 120, 80, 300],
};

export const feedback = {
  async prepare() {
    await ensure();
  },
  async cue(kind: Cue, opts: { audio: AudioMode; vibration: boolean; words?: string }) {
    if (opts.vibration) {
      if (kind === 'tick') void Haptics.selectionAsync();
      else Vibration.vibrate(VIBRATION[kind]);
    }
    if (opts.audio === 'tones') {
      await ensure();
      const p = players[kind];
      if (p) {
        p.seekTo(0);
        p.play();
      }
    } else if (opts.audio === 'voice' && opts.words) {
      Speech.stop();
      Speech.speak(opts.words, { rate: 1.0 });
    }
  },
  stop() {
    Speech.stop();
    Vibration.cancel();
  },
  release() {
    for (const k of Object.keys(players) as Cue[]) players[k]?.remove();
    ready = false;
  },
};
