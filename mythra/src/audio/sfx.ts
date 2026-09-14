// SFX engine (game feel): synthesized UI + object sounds, zero assets.
// Lazy AudioContext (created on first gesture), master on/off persisted.
// Every recipe is data (tone list) — unit-tested without audio hardware.

export type SfxName =
  | "click" | "confirm" | "error" | "denied"
  | "pickup" | "clue" | "mission" | "checkpoint" | "restore"
  | "talk" | "puzzle" | "door" | "fly" | "land" | "milestone";

interface Tone {
  freq: number;
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

export const RECIPES: Record<SfxName, Tone[]> = {
  click: [{ freq: 660, at: 0, dur: 0.06, type: "square", gain: 0.05 }],
  confirm: [
    { freq: 523, at: 0, dur: 0.09 },
    { freq: 784, at: 0.08, dur: 0.12 },
  ],
  error: [{ freq: 180, at: 0, dur: 0.18, type: "sawtooth", gain: 0.07 }],
  denied: [
    { freq: 300, at: 0, dur: 0.08, type: "square", gain: 0.05 },
    { freq: 220, at: 0.09, dur: 0.12, type: "square", gain: 0.05 },
  ],
  pickup: [
    { freq: 880, at: 0, dur: 0.07 },
    { freq: 1320, at: 0.06, dur: 0.1 },
  ],
  clue: [
    { freq: 392, at: 0, dur: 0.1 },
    { freq: 523, at: 0.09, dur: 0.1 },
    { freq: 659, at: 0.18, dur: 0.16 },
  ],
  mission: [
    { freq: 523, at: 0, dur: 0.12 },
    { freq: 659, at: 0.1, dur: 0.12 },
    { freq: 784, at: 0.2, dur: 0.12 },
    { freq: 1046, at: 0.3, dur: 0.22 },
  ],
  checkpoint: [
    { freq: 440, at: 0, dur: 0.1 },
    { freq: 660, at: 0.1, dur: 0.18 },
  ],
  restore: [
    { freq: 660, at: 0, dur: 0.1 },
    { freq: 440, at: 0.1, dur: 0.18 },
  ],
  talk: [{ freq: 480, at: 0, dur: 0.09, type: "triangle" }],
  puzzle: [
    { freq: 330, at: 0, dur: 0.1, type: "triangle" },
    { freq: 440, at: 0.1, dur: 0.14, type: "triangle" },
  ],
  door: [{ freq: 120, at: 0, dur: 0.25, type: "sawtooth", gain: 0.08 }],
  fly: [
    { freq: 220, at: 0, dur: 0.3, type: "sawtooth", gain: 0.04 },
    { freq: 440, at: 0.05, dur: 0.3, type: "sawtooth", gain: 0.03 },
  ],
  land: [{ freq: 140, at: 0, dur: 0.12, type: "sine", gain: 0.1 }],
  milestone: [
    { freq: 523, at: 0, dur: 0.14 },
    { freq: 659, at: 0.12, dur: 0.14 },
    { freq: 784, at: 0.24, dur: 0.14 },
    { freq: 1046, at: 0.36, dur: 0.3 },
  ],
};

const SFX_KEY = "lumen-sfx-v1";
let ctx: AudioContext | null = null;

export function sfxOn(): boolean {
  try {
    const raw = localStorage.getItem(SFX_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export function setSfxOn(on: boolean): void {
  try {
    localStorage.setItem(SFX_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function ensureCtx(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

/** Play a recipe. Silent when toggled off or unsupported. Returns false if skipped. */
export function sfx(name: SfxName): boolean {
  if (!sfxOn()) return false;
  const ac = ensureCtx();
  const recipe = RECIPES[name];
  if (!ac || !recipe) return false;
  try {
    const t0 = ac.currentTime;
    for (const tone of recipe) {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = tone.type ?? "sine";
      osc.frequency.value = tone.freq;
      const peak = tone.gain ?? 0.06;
      g.gain.setValueAtTime(0.0001, t0 + tone.at);
      g.gain.exponentialRampToValueAtTime(peak, t0 + tone.at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.at + tone.dur);
      osc.connect(g).connect(ac.destination);
      osc.start(t0 + tone.at);
      osc.stop(t0 + tone.at + tone.dur + 0.02);
    }
    return true;
  } catch {
    return false;
  }
}
