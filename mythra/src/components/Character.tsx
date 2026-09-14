// Character picker — your explorer, your suit. Persisted locally,
// broadcast to fellow solvers over presence.
import { useState } from "react";
import { CHARACTERS, loadCharacter, saveCharacter } from "../game/suits";
import { Icon } from "./icons";

function swatch(suit: number, accent: number): string {
  const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
  return `linear-gradient(135deg, ${hex(suit)} 55%, ${hex(accent)} 55%)`;
}

export function CharacterModal({ onClose }: { onClose: () => void }) {
  const [picked, setPicked] = useState(() => loadCharacter().id);
  const choose = (id: string) => {
    setPicked(id);
    saveCharacter(id);
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal card" style={{ width: "min(560px, 94vw)", position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <button className="btn-ghost" style={{ position: "absolute", top: 22, right: 10, padding: "0 8px" }} title="Close" onClick={onClose}>✕</button>
        <div className="case-kicker">Explorer roster · pick your suit</div>
        <h3 style={{ margin: "8px 0 4px" }}>Who descends?</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Your astronaut wears this everywhere — including in other solvers'
          skies when you play online.
        </p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", marginTop: 8 }}>
          {CHARACTERS.map((c) => {
            const active = picked === c.id;
            return (
              <button
                key={c.id}
                className={active ? "btn" : "btn-ghost"}
                style={{ display: "flex", gap: 10, alignItems: "center", textAlign: "left" }}
                onClick={() => choose(c.id)}
                title={c.blurb}
              >
                <span style={{ width: 30, height: 30, borderRadius: "50%", background: swatch(c.suit, c.accent), flex: "none", border: "2px solid rgba(0,0,0,.4)" }} />
                <span>
                  <b style={{ display: "block", fontSize: 13 }}>{c.label}</b>
                  <span className="muted" style={{ fontSize: 11 }}>{c.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={onClose}><Icon name="check" size={13} /> Suit up</button>
        </div>
      </div>
    </div>
  );
}
