// Audio self-test (skills.md §10): proves speaker + mic on THIS machine.
// Test tone (unconditional TTS), live mic level meter, 3s sample record +
// playback, and the exact permission state — no more guessing what's broken.
import { useEffect, useRef, useState } from "react";
import { isTtsSupported, loadVoiceSettings, speak } from "../audio/voice";
import { isRecordingSupported, listMicDevices } from "../audio/voiceNotes";
import type { MicDevice } from "../audio/voiceNotes";
import { Icon } from "./icons";

export function AudioTestModal({ onClose }: { onClose: () => void }) {
  const [toneMsg, setToneMsg] = useState("");
  const [perm, setPerm] = useState<string>("checking…");
  const [devices, setDevices] = useState<MicDevice[] | null>(null);
  const [level, setLevel] = useState(0);
  const [metering, setMetering] = useState(false);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [sampleMsg, setSampleMsg] = useState("");
  const meterRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    let alive = true;
    void listMicDevices().then((d) => {
      if (alive) setDevices(d);
    });
    (async () => {
      try {
        const q = await navigator.permissions?.query({ name: "microphone" as PermissionName });
        if (alive) setPerm(q?.state ?? "unknown");
      } catch {
        if (alive) setPerm("unknown (browser hides it)");
      }
    })();
    return () => {
      alive = false;
      try {
        meterRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const testTone = () => {
    const s = loadVoiceSettings();
    const ok = speak("Mythra audio check. If you hear this, the speaker path works.", { ...s, enabled: true });
    setToneMsg(ok ? "Tone sent — did you hear it? If not, check OS volume + the Voice toggle." : "Speech synthesis unavailable in this browser.");
  };

  const startMeter = async () => {
    if (!isRecordingSupported()) {
      setSampleMsg("Mic recording not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) {
        stream.getTracks().forEach((t) => t.stop());
        setSampleMsg("WebAudio unavailable.");
        return;
      }
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let raf = 0;
      let stopped = false;
      const loop = () => {
        if (stopped) return;
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
        setLevel(peak);
        raf = requestAnimationFrame(loop);
      };
      loop();
      setMetering(true);
      meterRef.current = {
        stop: () => {
          stopped = true;
          cancelAnimationFrame(raf);
          stream.getTracks().forEach((t) => t.stop());
          void ctx.close().catch(() => undefined);
          setMetering(false);
          setLevel(0);
        },
      };
    } catch (e) {
      const name = (e as { name?: string })?.name ?? "";
      setSampleMsg(
        name === "NotAllowedError"
          ? "Mic blocked — allow it in the browser address bar, then retry."
          : name === "NotFoundError"
            ? "No microphone found on this machine."
            : "Mic unavailable right now — close other apps using it and retry.",
      );
    }
  };

  const recordSample = async () => {
    setSampleMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      const done = new Promise<Blob>((resolve, reject) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          if (blob.size === 0) reject(new Error("empty"));
          else resolve(blob);
        };
        rec.onerror = () => reject(new Error("recorder"));
      });
      rec.start();
      setSampleMsg("Recording 3s — talk now…");
      window.setTimeout(() => {
        try {
          if (rec.state !== "inactive") rec.stop();
        } catch {
          /* ignore */
        }
      }, 3000);
      const blob = await done;
      if (sampleUrl) URL.revokeObjectURL(sampleUrl);
      setSampleUrl(URL.createObjectURL(blob));
      setSampleMsg("Sample ready — press play. Hear yourself = mic AND speaker both work.");
    } catch {
      setSampleMsg("Sample failed — see the mic hints above.");
    }
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal card" style={{ width: "min(540px, 94vw)" }} onClick={(e) => e.stopPropagation()}>
        <div className="case-kicker">Audio self-test · speaker + mic</div>
        <h3 style={{ margin: "8px 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>Prove it makes sound</h3>

        <label>1 · Speaker (TTS {isTtsSupported() ? "supported" : "NOT supported"})</label>
        <div className="row">
          <button className="btn" onClick={testTone}><Icon name="speaker" size={13} /> Play test sound</button>
        </div>
        {toneMsg && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{toneMsg}</div>}

        <label>2 · Microphone ({isRecordingSupported() ? "supported" : "NOT supported"} · permission: {perm})</label>
        <div className="dossier-meta" style={{ marginBottom: 6 }}>
          {devices === null
            ? "Scanning hardware…"
            : devices.length === 0
              ? "0 audio inputs — THIS machine has no microphone. Recording cannot work here; Dictate + TTS still do."
              : `${devices.length} input${devices.length === 1 ? "" : "s"}: ${devices.map((d) => d.label).join(" · ")}`}
        </div>
        <div className="row">
          {!metering ? (
            <button className="btn-ghost" onClick={() => void startMeter()}><Icon name="mic" size={13} /> Start level meter</button>
          ) : (
            <button className="btn-ghost" onClick={() => meterRef.current?.stop()}>Stop meter</button>
          )}
          <button className="btn-ghost" onClick={() => void recordSample()}>Record 3s sample</button>
        </div>
        <div style={{ height: 12, border: "1px solid var(--border-strong)", borderRadius: 6, marginTop: 8, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.round(level * 100)}%`, background: "linear-gradient(90deg, var(--th-accent), var(--th-accent2))" }} />
        </div>
        {sampleMsg && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{sampleMsg}</div>}
        {sampleUrl && <audio controls src={sampleUrl} style={{ width: "100%", marginTop: 8 }} />}

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
