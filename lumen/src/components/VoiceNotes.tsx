// Voice-note UI (skills.md §10.2): dictate text anywhere + record/playback
// clips attached to any target (clue/mission/location/object/chapter/story).
import { useEffect, useRef, useState } from "react";
import { isVoiceInputSupported, startListening } from "../audio/voice";
import {
  MAX_VOICE_SEC, filterNotesByTarget, getVoiceNoteURL, idbDeleteClip, idbPutClip,
  isRecordingSupported, makeVoiceNoteId, recordVoiceClip, revokeVoiceNoteURL,
} from "../audio/voiceNotes";
import type { VoiceNoteMeta, VoiceTargetKind } from "../audio/voiceNotes";
import { useLumen } from "../state/store";
import { Icon } from "./icons";

/* ---------------- Dictate: STT into any text field ---------------- */

export function DictateButton({ onText, title = "Dictate with your voice" }: { onText: (text: string) => void; title?: string }) {
  const [busy, setBusy] = useState(false);
  if (!isVoiceInputSupported()) return null;
  const run = () => {
    if (busy) return;
    setBusy(true);
    const stop = startListening(
      (heard) => {
        setBusy(false);
        onText(heard);
      },
      () => setBusy(false),
    );
    // one-shot; auto-stops on result. Safety timeout:
    window.setTimeout(() => {
      try {
        stop();
      } catch {
        /* ignore */
      }
      setBusy(false);
    }, 15000);
  };
  return (
    <button className="btn-ghost" title={title} onClick={run} style={{ padding: "2px 8px" }}>
      <Icon name="mic" size={13} /> {busy ? "Listening…" : "Dictate"}
    </button>
  );
}

/* ---------------- Recorder + clips for one target ---------------- */

interface RecorderProps {
  worldId: string;
  targetKind: VoiceTargetKind;
  targetId: string;
  label: string;
  compact?: boolean;
}

export function VoiceNoteRecorder({ worldId, targetKind, targetId, label, compact }: RecorderProps) {
  const { addVoiceNote, pushLog } = useLumen();
  const [recording, setRecording] = useState(false);
  const [sec, setSec] = useState(0);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const recRef = useRef<{ stop: () => void; cancel: () => void } | null>(null);

  useEffect(() => () => {
    try {
      recRef.current?.cancel();
    } catch {
      /* ignore */
    }
  }, []);

  if (!isRecordingSupported()) {
    return <div className="muted" style={{ fontSize: 12 }}>Mic recording not supported here — use Dictate for text.</div>;
  }

  const start = () => {
    setErr("");
    setSec(0);
    try {
      const api = recordVoiceClip({ maxSec: MAX_VOICE_SEC, onTick: setSec });
      recRef.current = api;
      setRecording(true);
      api.promise.then(
        async ({ blob, durationSec, mime }) => {
          setRecording(false);
          setSaving(true);
          try {
            const meta: VoiceNoteMeta = {
              id: makeVoiceNoteId(),
              worldId,
              targetKind,
              targetId,
              label: label.slice(0, 80),
              author: "you",
              createdAt: new Date().toISOString(),
              durationSec,
              mime,
            };
            await idbPutClip(meta.id, blob);
            addVoiceNote(meta);
            pushLog(`Voice note saved on ${label} (${durationSec}s).`);
          } catch {
            setErr("Could not save clip (storage full?).");
          } finally {
            setSaving(false);
          }
        },
        (e) => {
          setRecording(false);
          if ((e as Error)?.message !== "cancelled") setErr((e as Error)?.message ?? "Recording failed.");
        },
      );
    } catch (e) {
      setErr((e as Error)?.message ?? "Mic unavailable.");
    }
  };

  const stop = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  };

  return (
    <div style={{ marginTop: compact ? 4 : 6 }}>
      <div className="row" style={{ gap: 6 }}>
        {!recording ? (
          <button className="btn-ghost" disabled={saving} onClick={start} style={{ padding: "2px 8px" }} title={`Record your voice on ${label}`}>
            <Icon name="mic" size={13} /> {saving ? "Saving…" : "Narrate"}
          </button>
        ) : (
          <button className="btn" onClick={stop} title="Stop and save">
            <Icon name="stop" size={13} /> {sec}s — Stop
          </button>
        )}
      </div>
      {err && (
        <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>
          {err}
          <div className="muted" style={{ marginTop: 2 }}>Mic trouble? Dictation still works for text notes.</div>
        </div>
      )}
    </div>
  );
}

export function VoiceClipList({ worldId, targetKind, targetId }: { worldId: string; targetKind: VoiceTargetKind; targetId: string }) {
  const voiceNotes = useLumen((s) => s.voiceNotes);
  const { removeVoiceNote } = useLumen();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const clips = filterNotesByTarget(voiceNotes, targetKind, targetId, worldId);

  useEffect(() => {
    let alive = true;
    (async () => {
      const next: Record<string, string> = {};
      for (const c of clips) {
        const url = await getVoiceNoteURL(c.id);
        if (url) next[c.id] = url;
      }
      if (alive) setUrls(next);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceNotes.length, targetKind, targetId, worldId]);

  if (clips.length === 0) return null;

  const remove = async (id: string) => {
    try {
      await idbDeleteClip(id);
    } catch {
      /* ignore */
    }
    revokeVoiceNoteURL(id);
    removeVoiceNote(id);
  };

  return (
    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
      {clips.map((c) => (
        <div key={c.id} className="row" style={{ fontSize: 12, gap: 8, alignItems: "center" }}>
          <span className="pill cyan"><Icon name="mic" size={11} /> {c.durationSec}s</span>
          {urls[c.id] ? (
            <audio controls preload="metadata" src={urls[c.id]} style={{ height: 28, maxWidth: 220 }} />
          ) : (
            <span className="muted">loading…</span>
          )}
          <button className="btn-ghost" style={{ padding: "0 6px" }} title="Delete clip" onClick={() => void remove(c.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

/** Recorder + clips combined — drop onto ANY component. */
export function VoiceNotes({ worldId, targetKind, targetId, label, compact }: RecorderProps) {
  return (
    <div>
      <VoiceNoteRecorder worldId={worldId} targetKind={targetKind} targetId={targetId} label={label} compact={compact} />
      <VoiceClipList worldId={worldId} targetKind={targetKind} targetId={targetId} />
    </div>
  );
}

/* ---------------- Global library: narrate your own story ---------------- */

export function VoiceLibrary({ worldId }: { worldId: string }) {
  const voiceNotes = useLumen((s) => s.voiceNotes);
  const { loadVoiceNotes } = useLumen();
  useEffect(() => {
    loadVoiceNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const mine = voiceNotes.filter((n) => n.worldId === worldId).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const [filter, setFilter] = useState<string>("all");
  const kinds = ["all", ...Array.from(new Set(mine.map((m) => m.targetKind)))];
  const shown = filter === "all" ? mine : mine.filter((m) => m.targetKind === filter);

  return (
    <div className="hud-panel">
      <div className="row">
        <b><Icon name="mic" /> My narration</b>
        <span className="pill">{mine.length}</span>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ marginLeft: "auto", maxWidth: 130 }}>
          {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      {mine.length === 0 && (
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          No voice yet — hit <b>Narrate</b> on any mission, clue, location, object, or chapter and tell the story in your own voice.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
        {shown.map((c) => (
          <VoiceLibraryRow key={c.id} clip={c} worldId={worldId} />
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <div className="muted" style={{ fontSize: 12 }}>Free take (not tied to anything):</div>
        <VoiceNotes worldId={worldId} targetKind="free" targetId="free" label="free story beat" compact />
      </div>
    </div>
  );
}

function VoiceLibraryRow({ clip, worldId }: { clip: VoiceNoteMeta; worldId: string }) {
  const { removeVoiceNote } = useLumen();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void getVoiceNoteURL(clip.id).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [clip.id]);
  const remove = async () => {
    try {
      await idbDeleteClip(clip.id);
    } catch {
      /* ignore */
    }
    revokeVoiceNoteURL(clip.id);
    removeVoiceNote(clip.id);
  };
  return (
    <div style={{ fontSize: 13, borderTop: "1px solid var(--border)", paddingTop: 6 }}>
      <span className="pill">{clip.targetKind}</span> <b>{clip.label}</b>{" "}
      <span className="muted">{clip.durationSec}s · {new Date(clip.createdAt).toLocaleString()}</span>
      <div className="row" style={{ marginTop: 4 }}>
        {url ? <audio controls preload="metadata" src={url} style={{ height: 28, maxWidth: 240 }} /> : <span className="muted">loading…</span>}
        <button className="btn-ghost" style={{ padding: "0 6px" }} onClick={() => void remove()}>✕</button>
      </div>
      <VoiceClipMover clip={clip} worldId={worldId} />
    </div>
  );
}

/** Re-attach a clip to any component — "your voice anywhere". */
function VoiceClipMover({ clip }: { clip: VoiceNoteMeta; worldId: string }) {
  const voiceNotes = useLumen((s) => s.voiceNotes);
  const { addVoiceNote } = useLumen();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<VoiceTargetKind>(clip.targetKind);
  const [id, setId] = useState(clip.targetId);
  if (!open) return <button className="btn-ghost" style={{ padding: "0 6px", marginTop: 4 }} onClick={() => setOpen(true)}>↪ Attach elsewhere</button>;
  const existingTargets = Array.from(new Set(voiceNotes.map((n) => `${n.targetKind}:${n.targetId}`))).slice(0, 50);
  const save = () => {
    addVoiceNote({ ...clip, targetKind: kind, targetId: id.trim() || clip.targetId });
    setOpen(false);
  };
  return (
    <div className="row" style={{ marginTop: 4, gap: 6 }}>
      <select value={kind} onChange={(e) => setKind(e.target.value as VoiceTargetKind)} style={{ maxWidth: 120 }}>
        {(["clue", "mission", "location", "object", "chapter", "story", "free"] as VoiceTargetKind[]).map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <input value={id} onChange={(e) => setId(e.target.value)} placeholder="target id" list="vn-targets" style={{ maxWidth: 160 }} />
      <datalist id="vn-targets">
        {existingTargets.map((t) => <option key={t} value={t.split(":")[1]} />)}
      </datalist>
      <button className="btn" onClick={save}>Move</button>
      <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}
