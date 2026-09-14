// Checkpoint panel (skills.md G10): manual + auto progress snapshots.
// Restore rolls the run back; delete drops the file. Per explorer + world.
import { useEffect, useState } from "react";
import { useLumen } from "../state/store";
import { sfx } from "../audio/sfx";
import { Icon } from "./icons";

export function CheckpointPanel({ worldId }: { worldId: string }) {
  const checkpoints = useLumen((s) => s.checkpoints);
  const { loadCheckpoints, createCheckpoint, restoreCheckpoint, deleteCheckpoint } = useLumen();
  const [label, setLabel] = useState("");

  useEffect(() => {
    loadCheckpoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId]);

  const save = () => {
    createCheckpoint(label.trim() || `Manual · ${new Date().toLocaleTimeString()}`, "manual");
    sfx("checkpoint");
    setLabel("");
  };

  return (
    <div className="hud-panel">
      <div className="row">
        <b><Icon name="save" /> Checkpoints</b>
        <span className="pill">{checkpoints.length}</span>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name this checkpoint…"
          style={{ flex: 1 }}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />
        <button className="btn" onClick={save} title="Save a named checkpoint of this run">
          <Icon name="plus" /> Save
        </button>
      </div>
      {checkpoints.length === 0 && (
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          No checkpoints yet — the run auto-files one per mission and per new location.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {checkpoints.map((c) => (
          <div key={c.id} style={{ fontSize: 13, borderTop: "1px solid var(--border)", paddingTop: 6 }}>
            <span className="pill cyan">⚑ {(c.owner ?? "guest").split("@")[0]}</span>{" "}
            <span className={`pill ${c.kind === "manual" ? "cyan" : ""}`}>{c.kind}</span> <b>{c.label}</b>
            <div className="dossier-meta">{new Date(c.createdAt).toLocaleString()} · {c.snapshot.completedMissions.length} missions · {c.snapshot.discoveredClues.length} clues</div>
            <div className="row" style={{ marginTop: 4 }}>
              <button className="btn-ghost" style={{ padding: "2px 10px" }} onClick={() => { restoreCheckpoint(c.id); sfx("restore"); }}>
                <Icon name="arrow" /> Restore
              </button>
              <button className="btn-ghost" style={{ padding: "2px 8px" }} title="Delete checkpoint" onClick={() => deleteCheckpoint(c.id)}>
                <Icon name="close" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
