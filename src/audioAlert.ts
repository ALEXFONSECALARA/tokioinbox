// Web Audio API Sound Synthesizer for Tokio inBox Delivery Order Alerts
// Provides 5 custom, high-fidelity synthesizer sounds without external audio dependencies.

import { OrderSoundType } from '../types/restaurant';

export interface SoundPresetInfo {
  id: OrderSoundType;
  name: string;
  description: string;
  emoji: string;
}

export const SOUND_PRESETS: SoundPresetInfo[] = [
  {
    id: 'sound1',
    name: 'Alerta Curto e Chamativo',
    description: 'Dois bipes brilhantes e rápidos para atenção imediata',
    emoji: '🔔',
  },
  {
    id: 'sound2',
    name: 'Ding-Dong Cozinha Clássico',
    description: 'Sequência clássica de dois tons suaves com harmônicos',
    emoji: '🛎️',
  },
  {
    id: 'sound3',
    name: 'Alerta Urgente e Dinâmico',
    description: 'Pulso ascendente de quatro frequências com tom penetrante',
    emoji: '🚨',
  },
  {
    id: 'sound4',
    name: 'Arpeggio Harmônico 3 Notas',
    description: 'Acorde musical ascendente sofisticado (Dó-Mi-Sol-Dó)',
    emoji: '✨',
  },
  {
    id: 'sound5',
    name: 'Campainha Marimba & Punch',
    description: 'Batida com corpo grave de restaurante para ambientes barulhentos',
    emoji: '🔊',
  },
];

let audioCtx: AudioContext | null = null;
let isUnlocked = false;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().then(() => {
      isUnlocked = true;
    }).catch(() => {});
  }
  return audioCtx;
}

export function unlockAudio(): boolean {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    // Play a silent buffer to test/unlock
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(0.01);
    isUnlocked = true;
    return true;
  } catch (e) {
    console.warn('Audio unlock warning:', e);
    return false;
  }
}

export function checkAudioUnlocked(): boolean {
  if (!audioCtx) return false;
  return audioCtx.state === 'running';
}

export function playDelayAlertSound(volume: number = 0.8) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    const vol = Math.max(0.05, Math.min(1, volume));
    masterGain.gain.setValueAtTime(vol, now);
    masterGain.connect(ctx.destination);

    // Urgent late order warning buzz (alternating pulse)
    playTone(ctx, masterGain, 520, 'sawtooth', now, 0.15, 0.6);
    playTone(ctx, masterGain, 390, 'sawtooth', now + 0.18, 0.18, 0.7);
    playTone(ctx, masterGain, 520, 'sawtooth', now + 0.40, 0.15, 0.6);
    playTone(ctx, masterGain, 390, 'sawtooth', now + 0.58, 0.25, 0.8);
  } catch (err) {
    console.warn('Could not play delay alert sound:', err);
  }
}

export function triggerVibrate(pattern: number[] = [300, 100, 300, 100, 400]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
}

export function playAlertSound(type: OrderSoundType = 'sound1', volume: number = 0.8) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    // Clamp volume
    const vol = Math.max(0.05, Math.min(1, volume));
    masterGain.gain.setValueAtTime(vol, now);
    masterGain.connect(ctx.destination);

    switch (type) {
      case 'sound1': {
        // SOM 1: Alerta curto e chamativo (Dois bipes brilhantes ascendentes 880Hz -> 1320Hz)
        playTone(ctx, masterGain, 880, 'sine', now, 0.12, 0.6);
        playTone(ctx, masterGain, 1320, 'triangle', now + 0.14, 0.22, 0.7);
        break;
      }

      case 'sound2': {
        // SOM 2: Sequência clássica de dois tons (Ding-Dong harmônico 587Hz -> 880Hz)
        playTone(ctx, masterGain, 587.33, 'sine', now, 0.25, 0.8);
        playTone(ctx, masterGain, 880, 'sine', now + 0.22, 0.45, 0.7);
        // Soft chime overtone
        playTone(ctx, masterGain, 1760, 'sine', now + 0.22, 0.2, 0.2);
        break;
      }

      case 'sound3': {
        // SOM 3: Alerta mais urgente (Pulso duplo enérgico com tom vibrante 659Hz - 880Hz - 1046Hz)
        playTone(ctx, masterGain, 659.25, 'triangle', now, 0.08, 0.7);
        playTone(ctx, masterGain, 880, 'triangle', now + 0.09, 0.08, 0.7);
        playTone(ctx, masterGain, 1046.5, 'sine', now + 0.18, 0.14, 0.8);
        playTone(ctx, masterGain, 1318.5, 'sine', now + 0.30, 0.28, 0.85);
        break;
      }

      case 'sound4': {
        // SOM 4: Som de três notas (Arpeggio musical ascendente C5 -> E5 -> G5 -> C6)
        playTone(ctx, masterGain, 523.25, 'sine', now, 0.14, 0.6);
        playTone(ctx, masterGain, 659.25, 'sine', now + 0.12, 0.14, 0.65);
        playTone(ctx, masterGain, 783.99, 'sine', now + 0.24, 0.16, 0.7);
        playTone(ctx, masterGain, 1046.5, 'triangle', now + 0.36, 0.35, 0.75);
        break;
      }

      case 'sound5': {
        // SOM 5: Alerta contínuo/duplo para chamar atenção (Dois pulsos graves de marimba/punch)
        playTone(ctx, masterGain, 440, 'triangle', now, 0.12, 0.9);
        playTone(ctx, masterGain, 554.37, 'sine', now, 0.12, 0.6);
        playTone(ctx, masterGain, 659.25, 'triangle', now + 0.18, 0.28, 0.9);
        playTone(ctx, masterGain, 880, 'sine', now + 0.18, 0.32, 0.7);
        break;
      }

      default:
        playTone(ctx, masterGain, 880, 'sine', now, 0.18, 0.7);
    }
  } catch (err) {
    console.warn('Could not play alert sound:', err);
  }
}

function playTone(
  ctx: AudioContext,
  destination: AudioNode,
  frequency: number,
  type: OscillatorType,
  startTime: number,
  duration: number,
  peakGain: number = 0.8
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);

  // Attack and natural exponential decay
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}
