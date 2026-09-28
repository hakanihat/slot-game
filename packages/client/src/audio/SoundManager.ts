export type SoundId =
  | 'click'
  | 'spinStart'
  | 'reelStop'
  | 'scatterLand'
  | 'anticipation'
  | 'winSmall'
  | 'winBig'
  | 'featureStart'
  | 'featureEnd';

const MUTE_KEY = 'gem-rush.muted';

/**
 * Procedural sound effects via the Web Audio API — zero audio assets to ship,
 * tiny bundle, and every sound can be tuned in code. The context is created
 * lazily on the first user gesture to satisfy browser autoplay policies.
 */
export class SoundManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private anticipationStop: (() => void) | null = null;
  private mutedValue: boolean;

  constructor() {
    this.mutedValue = readMuted();
  }

  get muted(): boolean {
    return this.mutedValue;
  }

  setMuted(muted: boolean): void {
    this.mutedValue = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // ignore
    }
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
    if (muted) this.stopAnticipation();
  }

  /** Must be called from a user gesture handler. */
  unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.mutedValue ? 0 : 0.5;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  /** `variant` lets repeated sounds (e.g. each landing scatter) rise in pitch. */
  play(id: SoundId, variant = 0): void {
    const ctx = this.context;
    const out = this.master;
    if (!ctx || !out || this.mutedValue) return;
    const t = ctx.currentTime;

    switch (id) {
      case 'click':
        this.tone({ freq: 880, type: 'triangle', start: t, duration: 0.05, gain: 0.25 });
        break;
      case 'spinStart':
        this.noise({ start: t, duration: 0.25, gain: 0.18, filterFrom: 400, filterTo: 2400 });
        break;
      case 'reelStop':
        this.tone({ freq: 140, to: 70, type: 'sine', start: t, duration: 0.12, gain: 0.5 });
        this.noise({ start: t, duration: 0.04, gain: 0.08, filterFrom: 1800, filterTo: 900 });
        break;
      case 'scatterLand': {
        const base = 660 * 2 ** (variant / 4);
        this.tone({ freq: base, type: 'sine', start: t, duration: 0.5, gain: 0.3 });
        this.tone({ freq: base * 1.5, type: 'sine', start: t + 0.04, duration: 0.45, gain: 0.15 });
        break;
      }
      case 'anticipation':
        this.startAnticipation();
        break;
      case 'winSmall':
        this.arpeggio([523, 659, 784], t, 0.07, 0.25);
        break;
      case 'winBig':
        this.arpeggio([523, 659, 784, 1047, 1319, 1568], t, 0.09, 0.3);
        this.tone({ freq: 262, type: 'sawtooth', start: t, duration: 0.9, gain: 0.08 });
        break;
      case 'featureStart':
        this.arpeggio([392, 523, 659, 784, 1047, 1319, 1568, 2093], t, 0.06, 0.25);
        break;
      case 'featureEnd':
        this.arpeggio([1047, 784, 659, 784, 1047], t, 0.12, 0.3);
        break;
    }
  }

  stopAnticipation(): void {
    this.anticipationStop?.();
    this.anticipationStop = null;
  }

  private startAnticipation(): void {
    const ctx = this.context;
    const out = this.master;
    if (!ctx || !out || this.anticipationStop) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 1.6);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.3);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    osc.connect(filter).connect(gain).connect(out);
    osc.start();
    this.anticipationStop = () => {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      osc.stop(now + 0.2);
    };
  }

  private arpeggio(freqs: readonly number[], start: number, step: number, gain: number): void {
    freqs.forEach((freq, i) =>
      this.tone({ freq, type: 'triangle', start: start + i * step, duration: step * 3, gain }),
    );
  }

  private tone(opts: {
    freq: number;
    to?: number;
    type: OscillatorType;
    start: number;
    duration: number;
    gain: number;
  }): void {
    const ctx = this.context;
    const out = this.master;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, opts.start);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, opts.start + opts.duration);
    gain.gain.setValueAtTime(0.0001, opts.start);
    gain.gain.exponentialRampToValueAtTime(opts.gain, opts.start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, opts.start + opts.duration);
    osc.connect(gain).connect(out);
    osc.start(opts.start);
    osc.stop(opts.start + opts.duration + 0.05);
  }

  private noise(opts: {
    start: number;
    duration: number;
    gain: number;
    filterFrom: number;
    filterTo: number;
  }): void {
    const ctx = this.context;
    const out = this.master;
    if (!ctx || !out) return;
    const length = Math.ceil(ctx.sampleRate * opts.duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(opts.filterFrom, opts.start);
    filter.frequency.exponentialRampToValueAtTime(opts.filterTo, opts.start + opts.duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(opts.gain, opts.start);
    gain.gain.exponentialRampToValueAtTime(0.0001, opts.start + opts.duration);
    source.connect(filter).connect(gain).connect(out);
    source.start(opts.start);
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
