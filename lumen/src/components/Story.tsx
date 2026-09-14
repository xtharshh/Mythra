// Story layer (skills.md V3): everything feels like a story, not a form.
// Cinematic intro, location-discovery toasts, mission transmissions, NPC dialogue.
// Voice modules (skills.md §10): every beat speaks via speechSynthesis when enabled.
import { useEffect, useState } from "react";
import type { World } from "../types";
import { isTtsSupported, loadVoiceSettings, speak, stopSpeaking } from "../audio/voice";

export interface Beat { key: string; from: string; title: string; text: string; }

export const MISSION_BEATS: Record<string, Beat> = {
  m1_habitat: { key: "m1", from: "HAB-CTRL // auto-log", title: "Habitat Online", text: "Oxygen at 62% and climbing. If you're reading this, the drill worked. The lights stay on because of you. — I." },
  m2_solar: { key: "m2", from: "SOLAR-CTRL", title: "Power Restored", text: "Array output nominal. Something out on the ridge just woke up and pinged the tower. It knows we're here now." },
  m3_rover: { key: "m3", from: "RVR-NAV // recovered", title: "The Rover Remembers", text: "Last route: garage to western ridge, autopilot, no driver. Whatever rode in that seat — it wasn't crew." },
  m4_decode: { key: "m4", from: "Unknown frequency", title: "The Message Opens", text: "ORION. The hunter. Ivan always said: when lost, follow the hunter home. The hatch code is where the song lives." },
  m5_lab: { key: "m5", from: "LAB-CORE", title: "The Truth Below", text: "Sol 442: Ivan shut it all down himself — to keep what's in the vault from calling out. Now you decide what Earth hears." },
};

export const LAB_BEAT: Beat = {
  key: "lab",
  from: "SURVIVOR",
  title: "Someone Is Alive",
  text: "Easy. Easy. You're really here. I shut the colony down to bury it — now help me decide whether it stays buried.",
};

function useTypewriter(text: string, speed = 16): string {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setN(text.length); return; }
    const id = window.setInterval(() => {
      setN((v) => {
        if (v >= text.length) { window.clearInterval(id); return v; }
        return v + 1;
      });
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed]);
  return text.slice(0, n);
}

export function StoryIntro({ world, onBegin }: { world: World; onBegin: () => void }) {
  const full = `${world.story.premise} ${world.story.background} You are ${world.story.playerRole}.`;
  const typed = useTypewriter(full);
  const done = typed.length >= full.length;
  const narrate = () => {
    const s = loadVoiceSettings();
    if (s.enabled) speak(full, { ...s, enabled: true });
    else speak(full, { ...s, enabled: true });
  };
  return (
    <div className="veil">
      <div className="intro-card card">
        <div className="pill cyan">◉ incoming transmission</div>
        <h1 className="intro-title">{world.story.title}</h1>
        <p className="intro-text">{typed}<span className="caret" /></p>
        {done && (
          <>
            <div className="row intro-facts">
              {world.story.knownFacts.map((f) => <span key={f} className="pill amber">{f}</span>)}
            </div>
            <div className="muted intro-controls">WASD move · mouse look · E interact · F fly (with suit) · Shift sprint</div>
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn btn-big" onClick={onBegin}>▼ Begin descent</button>
              <button className="btn-ghost" title="Narrate briefing aloud" onClick={narrate}>🔊 Briefing</button>
            </div>
          </>
        )}
        {!done && <button className="btn-ghost" onClick={onBegin}>Skip ▸▸</button>}
      </div>
    </div>
  );
}

export interface Toast { id: number; name: string; desc: string; }

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className="toast card">
          <div className="pill cyan">◈ new location</div>
          <div><b>{t.name}</b></div>
          <div className="muted">{t.desc}</div>
        </div>
      ))}
    </div>
  );
}

export function TransmissionModal({ beat, onClose }: { beat: Beat; onClose: () => void }) {
  const [voiced, setVoiced] = useState(false);
  useEffect(() => {
    const s = loadVoiceSettings();
    if (s.enabled && s.autoNarrate && isTtsSupported()) {
      setVoiced(speak(`${beat.title}. ${beat.text}`, s));
    }
    return () => stopSpeaking();
  }, [beat]);
  const replay = () => {
    const s = loadVoiceSettings();
    if (!s.enabled) return;
    setVoiced(speak(`${beat.title}. ${beat.text}`, { ...s, enabled: true }));
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal card transmission" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <span className="eq"><i /><i /><i /><i /></span>
          <span className="pill amber">{beat.from}</span>
        </div>
        <h3>{beat.title}</h3>
        <p>{beat.text}</p>
        <div className="row">
          <button className="btn" onClick={onClose}>Copy that ✓</button>
          <button className="btn-ghost" title="Replay voice transmission" onClick={replay}>
            {voiced ? "🔊 Replay" : "🔈 Voice off"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DialogueModal({ name, lines, onClose }: { name: string; lines: string[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const line = lines[Math.min(i, lines.length - 1)] ?? "...static...";
  useEffect(() => {
    const s = loadVoiceSettings();
    if (s.enabled && s.autoNarrate && isTtsSupported()) speak(line, s);
    return () => stopSpeaking();
  }, [line]);
  const replay = () => {
    const s = loadVoiceSettings();
    if (s.enabled) speak(line, { ...s, enabled: true });
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <span className="pill cyan">{name}</span>
        <p className="dialogue-line">“{line}”</p>
        <div className="row">
          {i < lines.length - 1
            ? <button className="btn" onClick={() => setI(i + 1)}>▸ {i === 0 ? "Listen" : "Continue"}</button>
            : <button className="btn" onClick={onClose}>✓ Understood</button>}
          <button className="btn-ghost" title="Replay voice line" onClick={replay}>🔊</button>
          <button className="btn-ghost" onClick={onClose}>Leave</button>
        </div>
      </div>
    </div>
  );
}
