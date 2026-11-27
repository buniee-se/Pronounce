// Cozy, soft Web Audio API tactile sound synthesizer (zero external assets)

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

function playTone(
  freqStart: number,
  freqEnd: number,
  durationSec: number,
  gainPeak: number,
  type: OscillatorType = 'sine',
  delaySec = 0
) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, now);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + durationSec);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(gainPeak, now + Math.min(0.012, durationSec * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + durationSec + 0.015);
}

/** Soft, warm tactile click for buttons, tabs, and toggles */
export function playClick() {
  playTone(540, 340, 0.045, 0.055, 'triangle');
}

/** Crisp, uplifting pop when checking off a checklist item */
export function playCheck() {
  playTone(523.25, 659.25, 0.07, 0.075, 'sine', 0);
  playTone(783.99, 880, 0.095, 0.065, 'triangle', 0.045);
}

/** Gentle softer tap when unchecking a checklist item */
export function playUncheck() {
  playTone(420, 310, 0.055, 0.045, 'sine');
}

/** Dreamy ascending pentatonic chime when completing an entire checklist or focus timer */
export function playCompleteAll() {
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    playTone(freq, freq, 0.22, 0.07, 'sine', idx * 0.075);
    playTone(freq * 2, freq * 2, 0.14, 0.018, 'triangle', idx * 0.075);
  });
}

/** Delicate warm sparkle when highlighting an entry */
export function playHighlight() {
  playTone(698.46, 880, 0.09, 0.06, 'sine', 0);
  playTone(1046.5, 1174.66, 0.14, 0.05, 'triangle', 0.065);
}

/** Reassuring cozy confirmation when saving an entry or restoring from trash */
export function playSave() {
  playTone(440, 554.37, 0.09, 0.065, 'sine', 0);
  playTone(659.25, 659.25, 0.14, 0.06, 'sine', 0.065);
}

/** Soft low whoosh/tap when moving an entry to trash */
export function playTrash() {
  playTone(340, 170, 0.11, 0.06, 'triangle', 0);
}
