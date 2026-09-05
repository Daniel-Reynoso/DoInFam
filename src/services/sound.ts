import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, preload, type AudioSource } from 'expo-audio';

export type AppSound = 'buttonPop' | 'goalReached' | 'pinError' | 'weekFailed';

const SOUND_ENABLED_KEY = '@doinfam:sound-enabled';

const sources: Record<AppSound, AudioSource> = {
  buttonPop: require('../../assets/sounds/button-pop.mp3'),
  goalReached: require('../../assets/sounds/goal-party-horn.mp3'),
  pinError: require('../../assets/sounds/pin-error-pop.mp3'),
  weekFailed: require('../../assets/sounds/week-sad-trombone.mp3'),
};

const volumes: Record<AppSound, number> = {
  buttonPop: 0.28,
  goalReached: 0.58,
  pinError: 0.42,
  weekFailed: 0.5,
};

type AudioPlayer = ReturnType<typeof createAudioPlayer>;

const players = new Map<AppSound, AudioPlayer>();
let enabledCache: boolean | null = null;

Object.values(sources).forEach((source) => {
  try {
    const preloadResult = preload(source);
    if (preloadResult && typeof (preloadResult as Promise<void>).catch === 'function') {
      void (preloadResult as Promise<void>).catch(() => undefined);
    }
  } catch {
    // Preloading is an optimization only.
  }
});

async function resolveSoundEnabled() {
  if (enabledCache !== null) return enabledCache;
  const stored = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
  enabledCache = stored !== 'false';
  return enabledCache;
}

function getPlayer(sound: AppSound) {
  const existing = players.get(sound);
  if (existing) return existing;

  const player = createAudioPlayer(sources[sound], {
    keepAudioSessionActive: true,
    updateInterval: 1000,
  });
  player.volume = volumes[sound];
  players.set(sound, player);
  return player;
}

export async function getSoundEnabled() {
  return resolveSoundEnabled();
}

export async function setSoundEnabled(enabled: boolean) {
  enabledCache = enabled;
  await AsyncStorage.setItem(SOUND_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function playSound(sound: AppSound) {
  try {
    if (!(await resolveSoundEnabled())) return;
    const player = getPlayer(sound);
    await player.seekTo(0);
    player.volume = volumes[sound];
    player.play();
  } catch {
    // Sound should never block the main app flow.
  }
}
