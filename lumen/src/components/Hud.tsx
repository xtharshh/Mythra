// HUD: mission tracker, clue journal, inventory, puzzle modal, notifications (§16.1 play screen)
import { useState } from "react";
import type { Puzzle, World } from "../types";
import { checkPuzzleAnswer } from "../game/engines";
import { useLumen } from "../state/store";
import { DictateButton, VoiceNotes } from "./VoiceNotes";

export function MissionTracker({ world }: { world: World }) {
  const { activeMissions, completedMissions, gameState } = useLumen();
  const gs = gameState();
  const missions = world.missions.slice().sort((a, b) => a.order - b.order);
  return (
    <div className="hud-panel">
      <b>Missions</b>
      {missions.map((m) => {
        const done = completedMissions.includes(m.id);
        const active = activeMissions.includes(m.id);
        const locked = !done && !active && !m.prerequisites.every(() => true);
        void locked; void gs;
        return (
          <div key={m.id} style={{ marginTop: 8, fontSize: 13 }}>
            <span className={`pill ${done ? "green" : active ? "cyan" : ""}`}>{done ? "done" : active ? "active" : m.optional ? "optional" : "locked?"}</span>{" "}
            <b>{m.title}</b>
            <div className="muted">{m.objectives.map((o) => o.description).join(" · ")}</div>
            {!done && !active && <StartMissionButton id={m.id} />}
            <VoiceNotes worldId={world.id} targetKind="mission" targetId={m.id} label={m.title} compact />
          </div>
        );
      })}
    </div>
  );
}

function StartMissionButton({ id }: { id: string }) {
  const { startMission, pushLog } = useLumen();
  return <button className="btn-ghost" style={{ marginTop: 4 }} onClick={() => { startMission(id); pushLog(`Mission started: ${id}`); }}>Start</button>;
}

export function Journal({ world }: { world: World }) {
  const { discoveredClues, notes, setNote } = useLumen();
  const [open, setOpen] = useState(true);
  if (!open) return <button className="btn-ghost" onClick={() => setOpen(true)}>Open journal ({discoveredClues.length}/{world.clues.length})</button>;
  return (
    <div className="hud-panel">
      <div className="row"><b>Clue journal</b><span className="pill">{discoveredClues.length}/{world.clues.length}</span>
        <button className="btn-ghost" onClick={() => setOpen(false)}>Hide</button></div>
      {world.clues.map((c) => {
        const found = discoveredClues.includes(c.id);
        if (!found) return <div key={c.id} className="muted" style={{ fontSize: 13, marginTop: 6 }}>▓▓ {c.importance === "critical" ? "critical" : c.type} — undiscovered</div>;
        return (
          <div key={c.id} style={{ marginTop: 8, fontSize: 13 }}>
            <b>{c.title}</b> <span className="pill">{c.type}</span>
            <div>{c.text}</div>
            <div className="row" style={{ marginTop: 4 }}>
              <input placeholder="Your note…" value={notes[c.id] ?? ""} onChange={(e) => setNote(c.id, e.target.value)} style={{ flex: 1 }} />
              <DictateButton onText={(t) => setNote(c.id, `${notes[c.id] ?? ""} ${t}`.trim())} />
            </div>
            <VoiceNotes worldId={world.id} targetKind="clue" targetId={c.id} label={c.title} compact />
          </div>
        );
      })}
    </div>
  );
}

export function Inventory({ world }: { world: World }) {
  const inv = useLumen((s) => s.inventory);
  const names = new Map(world.resources.map((r) => [r.id, r.name]));
  return (
    <div className="hud-panel">
      <b>Inventory</b>
      {Object.keys(inv).length === 0 && <div className="muted" style={{ fontSize: 13 }}>Empty — collect scrap and salvage.</div>}
      {Object.entries(inv).map(([k, v]) => <div key={k} style={{ fontSize: 13 }}>{names.get(k) ?? k} × {v}</div>)}
    </div>
  );
}

export function PuzzleModal({ puzzle, onClose }: { puzzle: Puzzle; onClose: () => void }) {
  const { solvePuzzle, pushLog, collect } = useLumen();
  const [value, setValue] = useState("");
  const [hint, setHint] = useState(0);
  const [err, setErr] = useState("");
  const submit = () => {
    if (checkPuzzleAnswer(value, puzzle.solution, puzzle.solutionHash)) {
      solvePuzzle(puzzle.id);
      for (const r of puzzle.rewards) if (r.itemId) collect(r.itemId, r.quantity ?? 1);
      pushLog(`Puzzle solved: ${puzzle.title}`);
      onClose();
    } else setErr("Incorrect — check your clues and try again.");
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <b>{puzzle.title}</b>
        <p className="muted" style={{ fontSize: 14 }}>{puzzle.description}</p>
        <label>Answer</label>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Type answer…" />
        {err && <div style={{ color: "var(--red)", fontSize: 13, marginTop: 6 }}>{err}</div>}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={submit}>Submit</button>
          <button className="btn-ghost" onClick={() => setHint((h) => Math.min(h + 1, puzzle.hints.length))}>Hint ({hint}/{puzzle.hints.length})</button>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        {puzzle.hints.slice(0, hint).map((h) => <div key={h.order} className="muted" style={{ fontSize: 13, marginTop: 6 }}>💡 {h.text}</div>)}
      </div>
    </div>
  );
}

export function EventLog() {
  const log = useLumen((s) => s.log);
  return (
    <div className="hud-panel log">
      <div style={{ fontSize: 12, letterSpacing: 2, color: "var(--th-accent)", marginBottom: 6 }}>📡 EVENT LOG</div>
      {log.slice().reverse().map((m, i) => <div key={i}>{m}</div>)}
    </div>
  );
}
