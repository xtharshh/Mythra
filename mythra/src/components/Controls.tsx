// Controls panel (G9): rebind every playable action to YOUR keys.
// Multiple keys per action. Strict PC keys are rejected, never captured.
import { useEffect, useState } from "react";
import {
  ACTIONS, DEFAULT_BINDS, MAX_KEYS_PER_ACTION, checkBindable, loadBinds,
  prettyCode, saveBinds,
} from "../game/controls";
import type { Binds, GameAction } from "../game/controls";
import { Icon } from "./icons";

export const BINDS_EVENT = "storyforge:binds";

export function announceBinds(): void {
  try {
    window.dispatchEvent(new Event(BINDS_EVENT));
  } catch {
    /* ignore */
  }
}

export function ControlsModal({ onClose }: { onClose: () => void }) {
  const [binds, setBinds] = useState<Binds>(() => loadBinds());
  const [listening, setListening] = useState<GameAction | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") {
        setListening(null);
        setErr("");
        return;
      }
      const check = checkBindable(e);
      if (!check.ok) {
        setErr(check.reason);
        return;
      }
      setBinds((b) => {
        const cur = b[listening];
        if (cur.includes(e.code)) {
          setErr(`${prettyCode(e.code)} is already on this action.`);
          return b;
        }
        if (cur.length >= MAX_KEYS_PER_ACTION) {
          setErr(`Max ${MAX_KEYS_PER_ACTION} keys per action — remove one first.`);
          return b;
        }
        const next = { ...b, [listening]: [...cur, e.code] };
        saveBinds(next);
        return next;
      });
      setErr("");
      setListening(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listening]);

  const removeKey = (action: GameAction, code: string) => {
    setBinds((b) => {
      if (b[action].length <= 1) {
        setErr("Keep at least one key per action.");
        return b;
      }
      const next = { ...b, [action]: b[action].filter((c) => c !== code) };
      saveBinds(next);
      return next;
    });
  };

  const reset = () => {
    const d = structuredClone(DEFAULT_BINDS);
    setBinds(d);
    saveBinds(d);
    announceBinds();
    setErr("");
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal card" style={{ width: "min(560px, 94vw)" }} onClick={(e) => e.stopPropagation()}>
        <div className="case-kicker">Control deck · your keys, your rules</div>
        <h3 style={{ margin: "8px 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>Remap actions</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Click <b>+ Add</b>, then press any game key — up to {MAX_KEYS_PER_ACTION} per action.
          Browser/OS keys (Tab, Alt, F-keys…) are always rejected.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {ACTIONS.map((a) => (
            <div key={a.id} className="row" style={{ gap: 8, alignItems: "center" }}>
              <div style={{ minWidth: 150 }}>
                <b style={{ fontSize: 13 }}>{a.label}</b>
                <div className="dossier-meta">{a.hint}</div>
              </div>
              <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", flex: 1 }}>
                {binds[a.id].map((c) => (
                  <span key={c} className="key">{prettyCode(c)}
                    <button
                      title={`Unbind ${prettyCode(c)}`}
                      onClick={() => removeKey(a.id, c)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: "0 0 0 4px", font: "inherit" }}
                    >×</button>
                  </span>
                ))}
              </span>
              <button className="btn-ghost" style={{ padding: "2px 10px" }} onClick={() => { setListening(a.id); setErr(""); }} title={`Add a key for ${a.label}`}>
                <Icon name="plus" size={12} /> Add
              </button>
            </div>
          ))}
        </div>
        {listening && <div className="pill cyan" style={{ marginTop: 10 }}>Press a key for {ACTIONS.find((a) => a.id === listening)?.label}… (Esc cancels)</div>}
        {err && <div style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => { announceBinds(); onClose(); }}><Icon name="check" size={13} /> Done</button>
          <button className="btn-ghost" onClick={reset}>Reset defaults</button>
        </div>
      </div>
    </div>
  );
}
