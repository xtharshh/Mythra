// User-voice capture (skills.md §10.2): record your own voice on ANY game
// component (clue / mission / location / object / chapter / free story beat)
// and narrate your own story. Dictation (STT → text) reuses voice.ts.
// Audio blobs live in IndexedDB; metadata lives in Zustand + localStorage.
// All browser APIs are guarded so Vitest stays headless-safe.
import { ownerKey } from "../auth/auth";

export type VoiceTargetKind =
  | "clue"
  | "mission"
  | "location"
  | "object"
  | "chapter"
  | "story"
  | "free";

export interface VoiceNoteMeta {
  id: string;
  worldId: string;
  targetKind: VoiceTargetKind;
  /** entity id (clueId, missionId, locationId, objectId, entryId) or "free" bucket */
  targetId: string;
  label: string;
  author: string;
  createdAt: string;
  durationSec: number;
  mime: string;
  /** blob bytes, recorded at save time so the library can show real sizes */
  bytes?: number;
}

/** Where a user's recordings physically live (shown in the UI + docs). */
export const VOICE_STORAGE_NOTE =
  "Clips live in this browser: audio in IndexedDB “lumen-voice-notes-v1”, list in localStorage per explorer (“lumen-voice-notes-meta-v1”, filed under your login). Download any clip as .webm below.";

const META_KEY = "lumen-voice-notes-meta-v1";
const DB_NAME = "lumen-voice-notes-v1";
const DB_STORE = "clips";
export const MAX_VOICE_SEC = 120;

// ---------------------------------------------------------------------------
// pure helpers (unit-tested)
// ---------------------------------------------------------------------------

export function makeVoiceNoteId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `vn_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function voiceTargetKey(kind: VoiceTargetKind, id: string): string {
  return `${kind}:${id}`;
}

export function filterNotesByTarget(
  notes: VoiceNoteMeta[],
  kind: VoiceTargetKind,
  id: string,
  worldId?: string,
): VoiceNoteMeta[] {
  return notes
    .filter((n) => n.targetKind === kind && n.targetId === id && (!worldId || n.worldId === worldId))
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export interface MicDevice {
  id: string;
  label: string;
}

/** Verdict from a device list. Pure — unit-tested. */
export function micVerdict(devices: MicDevice[]): "no-mic" | "has-mic" {
  return devices.length === 0 ? "no-mic" : "has-mic";
}

/** List microphone hardware. Empty list = this machine truly has no mic
 *  (labels need granted permission; the COUNT works regardless). */
export async function listMicDevices(): Promise<MicDevice[]> {
  try {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    return all
      .filter((d) => d.kind === "audioinput")
      .map((d, i) => ({ id: d.deviceId || `mic-${i}`, label: d.label || `Microphone ${i + 1}` }));
  } catch {
    return [];
  }
}

/** Human size for clip rows. Pure. */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Metadata persistence (blobs stay in IndexedDB). Lists are per-username —
 *  each explorer hears only their own clips (guests keep the legacy key). */
export function loadVoiceNoteMetas(owner?: string): VoiceNoteMeta[] {
  try {
    const raw = localStorage.getItem(ownerKey(META_KEY, owner));
    if (!raw) return [];
    const arr = JSON.parse(raw) as VoiceNoteMeta[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveVoiceNoteMetas(notes: VoiceNoteMeta[], owner?: string): void {
  try {
    localStorage.setItem(ownerKey(META_KEY, owner), JSON.stringify(notes));
  } catch {
    /* ignore quota */
  }
}

// ---------------------------------------------------------------------------
// IndexedDB blob store (guarded)
// ---------------------------------------------------------------------------

function idbSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!idbSupported()) {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb open failed"));
  });
}

export async function idbPutClip(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("idb put failed"));
    });
  } finally {
    db.close();
  }
}

export async function idbGetClip(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).get(id);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? undefined);
      req.onerror = () => reject(req.error ?? new Error("idb get failed"));
    });
  } finally {
    db.close();
  }
}

export async function idbDeleteClip(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("idb delete failed"));
    });
  } finally {
    db.close();
  }
}

// object-URL cache for <audio> playback
const urlCache = new Map<string, string>();

export async function getVoiceNoteURL(id: string): Promise<string | null> {
  try {
    if (urlCache.has(id)) return urlCache.get(id)!;
    const blob = await idbGetClip(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
  } catch {
    return null;
  }
}

export function revokeVoiceNoteURL(id: string): void {
  try {
    const url = urlCache.get(id);
    if (url) URL.revokeObjectURL(url);
    urlCache.delete(id);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Recording (MediaRecorder, guarded)
// ---------------------------------------------------------------------------

export function isRecordingSupported(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined"
    );
  } catch {
    return false;
  }
}

export interface VoiceRecording {
  stop: () => void;
  cancel: () => void;
}

function pickMime(): string {
  try {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
    }
  } catch {
    /* ignore */
  }
  return "";
}

/** Map raw mic failures to actionable messages. Pure — unit-tested. */
export function mapMicError(e: unknown): string {
  const name = (e as { name?: string } | null)?.name ?? "";
  const raw = e instanceof Error ? e.message : String(e ?? "");
  switch (name) {
    case "NotAllowedError":
      return "Mic blocked — allow the microphone in the browser address bar, then retry. Or use Dictate.";
    case "NotFoundError":
      return "No microphone found — plug one in, or use Dictate for text.";
    case "NotReadableError":
      return "Mic is busy or unavailable (another app may be using it) — close other recorders and retry, or use Dictate.";
    case "OverconstrainedError":
      return "Mic doesn't match the requested setup — retry, or use Dictate.";
    case "SecurityError":
      return "Mic needs a secure page (HTTPS or localhost) — or use Dictate.";
    case "AbortError":
      return "Mic request was interrupted — retry.";
    default:
      if (/could not start audio source/i.test(raw)) {
        return "Mic is busy or unavailable (another app may be using it) — close other recorders and retry, or use Dictate.";
      }
      return raw || "Recording failed — retry, or use Dictate.";
  }
}
export function recordVoiceClip(
  opts: { maxSec?: number; onTick?: (sec: number) => void } = {},
): { promise: Promise<{ blob: Blob; durationSec: number; mime: string }>; stop: () => void; cancel: () => void } {
  const maxSec = Math.min(MAX_VOICE_SEC, Math.max(5, opts.maxSec ?? 60));
  let rec: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let timer: number | null = null;
  let cancelled = false;
  const startedAt = Date.now();

  const tick = () => {
    const sec = Math.floor((Date.now() - startedAt) / 1000);
    opts.onTick?.(sec);
    if (sec >= maxSec) api.stop();
  };

  const api: {
    promise: Promise<{ blob: Blob; durationSec: number; mime: string }>;
    stop: () => void;
    cancel: () => void;
  } = {
    promise: (async () => {
      if (!isRecordingSupported()) throw new Error("Recording not supported in this browser.");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        throw new Error(mapMicError(e));
      }
      const mime = pickMime();
      const chunks: BlobPart[] = [];
      try {
        rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch (e) {
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          /* ignore */
        }
        stream = null;
        throw new Error(mapMicError(e));
      }
      const done = new Promise<{ blob: Blob; durationSec: number; mime: string }>((resolve, reject) => {
        if (!rec) {
          reject(new Error("Recorder failed to start."));
          return;
        }
        rec.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) chunks.push(ev.data);
        };
        rec.onerror = (ev) => reject(new Error(mapMicError((ev as ErrorEvent)?.error ?? "Recording failed.")));
        rec.onstop = () => {
          try {
            if (timer !== null) {
              window.clearInterval(timer);
              timer = null;
            }
            stream?.getTracks().forEach((t) => t.stop());
            if (cancelled) {
              reject(new Error("cancelled"));
              return;
            }
            const type = rec?.mimeType || mime || "audio/webm";
            const blob = new Blob(chunks, { type });
            const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
            if (blob.size === 0) {
              reject(new Error("Empty recording — mic captured nothing."));
              return;
            }
            resolve({ blob, durationSec, mime: type });
          } catch (e) {
            reject(e instanceof Error ? e : new Error("Recording failed."));
          } finally {
            rec = null;
          }
        };
      });
      rec.start(250);
      timer = window.setInterval(tick, 500);
      return done;
    })(),
    stop: () => {
      try {
        if (rec && rec.state !== "inactive") rec.stop();
        else if (timer !== null) window.clearInterval(timer);
      } catch {
        /* ignore */
      }
    },
    cancel: () => {
      cancelled = true;
      try {
        if (rec && rec.state !== "inactive") rec.stop();
      } catch {
        /* ignore */
      }
      try {
        if (timer !== null) window.clearInterval(timer);
      } catch {
        /* ignore */
      }
      stream?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
    },
  };
  // surface async setup errors to callers awaiting promise; stop/cancel stay sync
  api.promise.catch(() => {
    try {
      if (timer !== null) window.clearInterval(timer);
    } catch {
      /* ignore */
    }
  });
  return api;
}
