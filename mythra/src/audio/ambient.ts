// Ambient universe sound (skills.md §10.5): the background hums like the
// story demands — Mars gets a deep dust-drone with sparse orbital pings,
// oceans go lower and slower, forests breathe lighter. 100% synthesized
// WebAudio, zero assets. Starts on first gesture (autoplay policy), stops
// when you leave the Surface. Pure theme table, unit-tested.

export interface AmbientTheme {
  /** drone root frequency (Hz) */
  root: number;
  /** pentatonic-ish ping pool (Hz) */
  shimmer: number[];
  /** lowpass ceiling for the drone */
  cutoff: number;
  /** wind bed loudness 0..1 */
  wind: number;
  /** seconds between twinkles [min, max] */
  twinkleEvery: [number, number];
  label: string;
}

export const AMBIENT_THEMES: Record<string, AmbientTheme> = {
  mars: {
    root: 55, shimmer: [440, 523.25, 587.33, 659.25, 880], cutoff: 320,
    wind: 0.5, twinkleEvery: [7, 16], label: "dust drone",
  },
  space: {
    root: 48, shimmer: [392, 494, 587.33, 740, 988], cutoff: 260,
    wind: 0.25, twinkleEvery: [9, 20], label: "void hum",
  },
  ocean: {
    root: 41.2, shimmer: [329.63, 392, 440, 523.25, 659.25], cutoff: 220,
    wind: 0.8, twinkleEvery: [10, 22], label: "deep swell",
  },
  forest: {
    root: 65.4, shimmer: [523.25, 587.33, 659.25, 783.99, 1046.5], cutoff: 520,
    wind: 0.45, twinkleEvery: [4, 10], label: "canopy air",
  },
  fantasy: {
    root: 58.27, shimmer: [466.16, 554.37, 622.25, 698.46, 932.33], cutoff: 420,
    wind: 0.4, twinkleEvery: [6, 14], label: "ward shimmer",
  },
};

export function ambientFor(theme: string): AmbientTheme {
  return AMBIENT_THEMES[theme] ?? {
    root: 55, shimmer: [440, 523.25, 659.25, 880], cutoff: 320,
    wind: 0.5, twinkleEvery: [7, 16], label: "dust drone",
  };
}

const AMBIENT_KEY = "lumen-ambient-v1";

export function loadAmbience(): boolean {
  try {
    const raw = localStorage.getItem(AMBIENT_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export function saveAmbience(on: boolean): void {
  try {
    localStorage.setItem(AMBIENT_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function makeNoise(ctx: AudioContext): AudioBufferSourceNode {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private started = false;
  private theme = "mars";

  /** Begin the bed (no-op if already playing). Returns false when blocked. */
  start(theme: string): boolean {
    try {
      if (typeof window === "undefined") return false;
      if (this.started) {
        this.retune(theme);
        return true;
      }
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return false;
      const cfg = ambientFor(theme);
      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);

      // deep drone: root + fifth, slow filter breathing
      const droneGain = ctx.createGain();
      droneGain.gain.value = 0.05;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cfg.cutoff;
      const breathe = ctx.createOscillator();
      breathe.frequency.value = 0.05;
      const breatheAmt = ctx.createGain();
      breatheAmt.gain.value = cfg.cutoff * 0.55;
      breathe.connect(breatheAmt).connect(filter.frequency);
      for (const [mult, detune] of [[1, 0], [1.5, 5]] as const) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = cfg.root * mult;
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start();
      }
      filter.connect(droneGain).connect(master);
      breathe.start();

      // wind bed: looped noise through a wandering bandpass
      const noise = makeNoise(ctx);
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 420;
      band.Q.value = 0.5;
      const wander = ctx.createOscillator();
      wander.frequency.value = 0.07;
      const wanderAmt = ctx.createGain();
      wanderAmt.gain.value = 220;
      wander.connect(wanderAmt).connect(band.frequency);
      const windGain = ctx.createGain();
      windGain.gain.value = 0.022 * cfg.wind;
      noise.connect(band).connect(windGain).connect(master);
      noise.start();
      wander.start();

      this.ctx = ctx;
      this.master = master;
      this.theme = theme;
      this.started = true;
      master.gain.setTargetAtTime(0.9, ctx.currentTime, 2.2);
      this.scheduleTwinkle(cfg);
      return true;
    } catch {
      return false;
    }
  }

  private scheduleTwinkle(cfg: AmbientTheme): void {
    if (!this.started) return;
    const [lo, hi] = cfg.twinkleEvery;
    const wait = (lo + Math.random() * (hi - lo)) * 1000;
    this.timer = window.setTimeout(() => {
      this.ping(cfg);
      this.scheduleTwinkle(ambientFor(this.theme));
    }, wait);
  }

  private ping(cfg: AmbientTheme): void {
    try {
      if (!this.ctx || !this.master || !this.started) return;
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = cfg.shimmer[Math.floor(Math.random() * cfg.shimmer.length)];
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.028, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 2.6);
    } catch {
      /* ignore */
    }
  }

  retune(theme: string): void {
    this.theme = theme;
  }

  stop(): void {
    try {
      if (this.timer !== null) {
        window.clearTimeout(this.timer);
        this.timer = null;
      }
      if (this.ctx && this.master) {
        const ctx = this.ctx;
        this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
        window.setTimeout(() => {
          ctx.close().catch(() => undefined);
        }, 1200);
      }
    } catch {
      /* ignore */
    } finally {
      this.ctx = null;
      this.master = null;
      this.started = false;
    }
  }

  playing(): boolean {
    return this.started;
  }
}

export const ambient = new AmbientEngine();
