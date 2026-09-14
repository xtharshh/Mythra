import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MockProvider } from "../ai/mockProvider";
import { validateWorld } from "../game/engines";
import type { Difficulty } from "../types";
import { useLumen } from "../state/store";

export default function Create() {
  const nav = useNavigate();
  const { addWorld, pushLog } = useLumen();
  const [prompt, setPrompt] = useState("Create an abandoned Mars colony where players rebuild the habitat and find a hidden lab");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");

  const generate = async () => {
    setBusy(true); setError(""); setPreview("");
    try {
      const world = await new MockProvider().generateWorldPlan({
        prompt, difficulty, missionCount: 5, clueDensity: "medium", puzzleIntensity: "medium",
        allowConstruction: false, allowPlayerContributions: true,
      });
      const report = validateWorld(world);
      if (!report.valid) {
        setError(`Expedition brief rejected: ${report.errors.slice(0, 3).map((e) => e.message).join(" | ")}`);
        return;
      }
      addWorld(world);
      pushLog(`Expedition filed: ${world.name}`);
      setPreview(`✔ ${world.name} filed — ${world.missions.length} missions, ${world.clues.length} clues, ${world.puzzles.length} puzzles. Est. ${report.estimatedMinutes} min surface time.`);
      setTimeout(() => nav("/play"), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Planner failed — brief preserved, retry.");
    } finally { setBusy(false); }
  };

  return (
    <div className="layout">
      <div className="case-kicker">✎ expedition planner · no uplink key needed</div>
      <h2 className="case-title" style={{ fontSize: 34 }}>File a new <em>expedition.</em></h2>
      <p className="muted">Write the brief like a station chief. The planner stamps it into a walkable case file.</p>
      <div className="console" style={{ marginTop: 14 }}>
        <div className="console-bar"><i style={{ background: "#ff5a5a" }} /><i style={{ background: "#fbbf24" }} /><i style={{ background: "#7ddf9a" }} /> AURORA PLANNER · DRAFT BRIEF</div>
        <div className="console-body">
          <label>Expedition brief</label>
          <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <div className="row">
            <div style={{ minWidth: 220 }}><label>Hazard rating</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                {(["beginner", "easy", "medium", "hard", "expert"] as Difficulty[]).map((d) => <option key={d} value={d}>{d}</option>)}
              </select></div>
            <div className="dossier-meta" style={{ alignSelf: "flex-end" }}>5 missions · med clues · med puzzles · contributions open</div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" disabled={busy || !prompt.trim()} onClick={generate}>{busy ? "Stamping file…" : "Stamp expedition file"}</button>
          </div>
          {error && <div style={{ color: "var(--red)", marginTop: 8 }}>{error}</div>}
          {preview && <div style={{ color: "var(--green)", marginTop: 8 }}>{preview}</div>}
        </div>
      </div>
    </div>
  );
}
