// Voice modules (skills.md §10): browser-native TTS narration + voice commands.
// No deps, guarded for headless tests (vitest has no speechSynthesis).
// Output: speechSynthesis speaks story beats / dialogue / log lines.
// Input: SpeechRecognition maps phrases to game actions.

export interface VoiceSettings {
  enabled: boolean;
  autoNarrate: boolean;
  rate: number;
  pitch: number;
  voiceURI: string | null;
}

const LS_KEY = "lumen-voice-v1";

const DEFAULTS: VoiceSettings = {
  enabled: false,
  autoNarrate: true,
  rate: 1,
  pitch: 0.9,
  voiceURI: null,
};

export function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<VoiceSettings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveVoiceSettings(s: VoiceSettings): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isTtsSupported()) return [];
  try {
    return window.speechSynthesis.getVoices();
  } catch {
    return [];
  }
}

function pickVoice(uri: string | null): SpeechSynthesisVoice | null {
  if (!isTtsSupported()) return null;
  const voices = getAvailableVoices();
  if (voices.length === 0) return null;
  if (uri) {
    const found = voices.find((v) => v.voiceURI === uri);
    if (found) return found;
  }
  // prefer an English voice so mission radio sounds right out of the box
  return (
    voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female")) ??
    voices.find((v) => v.lang.startsWith("en")) ??
    voices[0]
  );
}

/** Speak text; no-op when disabled/unsupported. Cancels overlapping speech first. */
export function speak(text: string, settings: VoiceSettings): boolean {
  if (!settings.enabled || !isTtsSupported()) return false;
  const clean = text.trim().slice(0, 600);
  if (!clean) return false;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(clean);
    const voice = pickVoice(settings.voiceURI);
    if (voice) utter.voice = voice;
    utter.rate = Math.min(2, Math.max(0.5, settings.rate));
    utter.pitch = Math.min(2, Math.max(0, settings.pitch));
    window.speechSynthesis.speak(utter);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking(): void {
  try {
    if (isTtsSupported()) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Voice commands (input)
// ---------------------------------------------------------------------------

export type VoiceAction =
  | { action: "interact" }
  | { action: "fly" }
  | { action: "save" }
  | { action: "readLog" }
  | { action: "stop" }
  | { action: "unknown"; heard: string };

/** Pure parser — unit-tested, no browser APIs. Order matters: fly before take. */
export function parseVoiceCommand(transcript: string): VoiceAction {
  const t = transcript.trim().toLowerCase();
  if (/(take off|fly|thruster|\bsuit\b|launch)/.test(t)) return { action: "fly" };
  if (/(save|checkpoint)/.test(t)) return { action: "save" };
  if (/(read|log|repeat|what happened)/.test(t)) return { action: "readLog" };
  if (/(stop|quiet|silence|shut up)/.test(t)) return { action: "stop" };
  if (/(collect|interact|take|grab|inspect|use|activate|talk|salvage)/.test(t)) return { action: "interact" };
  return { action: "unknown", heard: transcript };
}

export function isVoiceInputSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return typeof w.SpeechRecognition === "function" || typeof w.webkitSpeechRecognition === "function";
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

/** Start one-shot listening. Returns a stop function. Callbacks run on the main thread. */
export function startListening(
  onFinal: (transcript: string) => void,
  onError?: (message: string) => void,
): () => void {
  const w = window as unknown as Record<string, new () => RecognitionLike>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (typeof Ctor !== "function") {
    onError?.("Voice input not supported in this browser.");
    return () => undefined;
  }
  let rec: RecognitionLike | null = null;
  try {
    rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      try {
        const last = ev.results[ev.results.length - 1];
        const transcript = last[0]?.transcript ?? "";
        if (transcript) onFinal(transcript);
      } catch {
        /* ignore */
      }
    };
    rec.onerror = (ev) => onError?.(ev.error ?? "mic error");
    rec.onend = () => {
      rec = null;
    };
    rec.start();
  } catch {
    onError?.("Could not start microphone.");
  }
  return () => {
    try {
      rec?.stop();
    } catch {
      /* ignore */
    }
    rec = null;
  };
}
