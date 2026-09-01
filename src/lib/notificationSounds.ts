/**
 * Notification Sounds — Per-type sound & vibration customization
 *
 * Each notification type can have independent sound + vibration settings.
 * Uses Web Audio API for short beeps (no external audio files needed).
 * Falls back to navigator.vibrate() for haptic feedback.
 */

import type { NotificationType } from './notify';

export interface SoundSettings {
  global_sound: boolean;
  global_vibration: boolean;
  roast: { sound: boolean; vibration: boolean };
  follow: { sound: boolean; vibration: boolean };
  dm: { sound: boolean; vibration: boolean };
  upvote: { sound: boolean; vibration: boolean };
  levelup: { sound: boolean; vibration: boolean };
  battle: { sound: boolean; vibration: boolean };
}

const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  global_sound: true,
  global_vibration: true,
  roast: { sound: true, vibration: true },
  follow: { sound: true, vibration: true },
  dm: { sound: true, vibration: true },
  upvote: { sound: true, vibration: true },
  levelup: { sound: true, vibration: true },
  battle: { sound: true, vibration: true },
};

// In-memory cache
let cachedSettings: SoundSettings | null = null;
let cacheUserId: string | null = null;

/**
 * Load sound settings from localStorage (fast, no DB hit)
 */
export function loadSoundSettings(userId: string): SoundSettings {
  if (cachedSettings && cacheUserId === userId) return cachedSettings;

  try {
    const raw = localStorage.getItem(`burnboard_sounds_${userId}`);
    if (raw) {
      cachedSettings = { ...DEFAULT_SOUND_SETTINGS, ...JSON.parse(raw) };
      cacheUserId = userId;
      return cachedSettings;
    }
  } catch {}

  cachedSettings = DEFAULT_SOUND_SETTINGS;
  cacheUserId = userId;
  return cachedSettings;
}

/**
 * Save sound settings to localStorage
 */
export function saveSoundSettings(userId: string, settings: SoundSettings): void {
  try {
    localStorage.setItem(`burnboard_sounds_${userId}`, JSON.stringify(settings));
    cachedSettings = settings;
    cacheUserId = userId;
  } catch {}
}

/**
 * Update a single type's sound/vibration setting
 */
export function updateSoundSetting(
  userId: string,
  type: 'global_sound' | 'global_vibration' | NotificationType,
  field: 'sound' | 'vibration',
  value: boolean
): SoundSettings {
  const settings = loadSoundSettings(userId);

  if (type === 'global_sound') {
    settings.global_sound = value;
  } else if (type === 'global_vibration') {
    settings.global_vibration = value;
  } else {
    settings[type] = { ...settings[type], [field]: value };
  }

  saveSoundSettings(userId, settings);
  return settings;
}

// ── Sound Playback (Web Audio API) ──────────────────────────

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/**
 * Play a short beep tone. Different types get different frequencies.
 */
function playBeep(frequency: number, duration: number = 0.15, volume: number = 0.3): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Resume context if suspended (autoplay policy)
    if (ctx.state === 'suspended') ctx.resume();

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch {}
}

/**
 * Play a double-beep (for DMs — urgent)
 */
function playDoubleBeep(freq1: number, freq2: number): void {
  playBeep(freq1, 0.1, 0.25);
  setTimeout(() => playBeep(freq2, 0.12, 0.25), 120);
}

/**
 * Play a rising tone (for level ups — celebratory)
 */
function playRisingTone(): void {
  playBeep(440, 0.1, 0.2);
  setTimeout(() => playBeep(554, 0.1, 0.2), 100);
  setTimeout(() => playBeep(659, 0.15, 0.25), 200);
}

// ── Vibration Patterns ──────────────────────────────────────

const VIBRATION_PATTERNS: Record<NotificationType, number[]> = {
  roast: [50],           // Short tap
  follow: [30, 20, 30],  // Double tap
  dm: [50, 30, 50, 30, 50], // Triple tap — urgent
  upvote: [40],          // Light tap
  levelup: [30, 50, 30, 50, 100], // Celebration pattern
  battle: [60, 40, 60],  // Aggressive double
};

/**
 * Trigger vibration pattern for a notification type
 */
function triggerVibration(type: NotificationType): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;

  try {
    const pattern = VIBRATION_PATTERNS[type] || [50];
    navigator.vibrate(pattern);
  } catch {}
}

// ── Sound Profiles per Type ─────────────────────────────────

const TYPE_SOUNDS: Record<NotificationType, () => void> = {
  roast: () => playBeep(880, 0.12, 0.3),        // High sharp beep
  follow: () => playBeep(660, 0.15, 0.25),       // Medium warm beep
  dm: () => playDoubleBeep(880, 1100),            // Double high — urgent
  upvote: () => playBeep(780, 0.1, 0.2),         // Quick pop
  levelup: () => playRisingTone(),                // Rising celebration
  battle: () => playDoubleBeep(660, 880),         // Aggressive double
};

// ── Public API ──────────────────────────────────────────────

/**
 * Play notification sound + vibration for a type.
 * Respects user's per-type settings.
 */
export function playNotificationSound(
  type: NotificationType,
  userId: string | null
): void {
  if (!userId) return;

  const settings = loadSoundSettings(userId);
  const typeSettings = settings[type] || { sound: true, vibration: true };

  // Sound
  if (settings.global_sound && typeSettings.sound) {
    const playFn = TYPE_SOUNDS[type];
    if (playFn) playFn();
  }

  // Vibration
  if (settings.global_vibration && typeSettings.vibration) {
    triggerVibration(type);
  }
}

/**
 * Play a test sound for a specific type (used in settings preview)
 */
export function playTestSound(type: NotificationType): void {
  const playFn = TYPE_SOUNDS[type];
  if (playFn) playFn();
  triggerVibration(type);
}
