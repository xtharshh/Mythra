import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MockProvider } from "../ai/mockProvider";
import { PROVIDERS, endpointFor, generateWorldPlan, loadAIConfig, saveAIConfig } from "../ai/providers";
import type { AIConfig, AIProviderId } from "../ai/providers";
import { validateWorld } from "../game/engines";
import type { Difficulty } from "../types";
import { useLumen } from "../state/store";
import { Icon } from "../components/icons";

export default function Create() {
  const nav = useNavigate();
  const { addWorld, pushLog } = useLumen();
  const [prompt, setPrompt] = useState("Create an abandoned Mars colony where players rebuild the habitat and find a hidden lab");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [cfg, setCfg] = useState<AIConfig>(() => loadAIConfig());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");

  const meta = PROVIDERS.find((p) => p.id === cfg.provider)!;

  const set = (patch: Partial<AIConfig>) => {
    setCfg((c) => {
      const next = { ...c, ...patch };
      saveAIConfig(next);
      return next;
    });
  };

  const pickProvider = (id: AIProviderId) => {
    const m = PROVIDERS.find((p) => p.id === id)!;
    set({ provider: id, model: m.defaultModel });
  };

  const run = async (useMock: boolean) => {
    setBusy(true); setError(""); setPreview("");
    try {
      const effective: AIConfig = useMock ? { provider: "mock", apiKey: "", model: "mock-1" } : cfg;
      if (!useMock) saveAIConfig(cfg);
      const world = useMock
        ? await new MockProvider().generateWorldPlan({
            prompt, difficulty, missionCount: 5, clueDensity: "medium", puzzleIntensity: "medium",
            allowConstruction: false, allowPlayerContributions: true,
          })
        : await generateWorldPlan({
            prompt, difficulty, missionCount: 5, clueDensity: "medium", puzzleIntensity: "medium",
            allowConstruction: false, allowPlayerContributions: true,
          }, effective);
      const report = validateWorld(world);
      if (!report.valid) {
        setError(`Expedition brief rejected: ${report.errors.slice(0, 3).map((e) => e.message).join(" | ")}`);
        return;
      }
      addWorld(world);
      pushLog(`Expedition filed: ${world.name} (via ${useMock ? "Mock" : meta.label})`);
      setPreview(`✔ ${world.name} filed — ${world.missions.length} missions, ${world.clues.length} clues, ${world.puzzles.length} puzzles. Est. ${report.estimatedMinutes} min surface time.`);
      setTimeout(() => nav("/play"), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Planner failed — brief preserved, retry.");
    } finally { setBusy(false); }
  };

  return (
    <div className="layout">
      <div className="case-kicker">Expedition planner · any story, any genre</div>
      <h2 className="case-title" style={{ fontSize: 34 }}>File a new <em>expedition.</em></h2>
      <p className="muted">Write the brief like a station chief. Bring any AI key — or stamp it keyless with Mock.</p>
      <div className="console" style={{ marginTop: 14 }}>
        <div className="console-bar"><i style={{ background: "#ff5a5a" }} /><i style={{ background: "#fbbf24" }} /><i style={{ background: "#7ddf9a" }} /> MYTHRA PLANNER · DRAFT BRIEF</div>
        <div className="console-body">
          <label>Expedition brief</label>
          <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <div className="row">
            <div style={{ minWidth: 180 }}><label>Hazard rating</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                {(["beginner", "easy", "medium", "hard", "expert"] as Difficulty[]).map((d) => <option key={d} value={d}>{d}</option>)}
              </select></div>
            <div style={{ minWidth: 220 }}><label>AI director</label>
              <select value={cfg.provider} onChange={(e) => pickProvider(e.target.value as AIProviderId)}>
                {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select></div>
          </div>
          {cfg.provider !== "mock" && (
            <div className="row">
              <div style={{ flex: "2 1 220px" }}><label>Model</label>
                <input value={cfg.model} onChange={(e) => set({ model: e.target.value })} placeholder={meta.defaultModel} /></div>
              <div style={{ flex: "3 1 260px" }}><label>{meta.keyName} — stays in this browser</label>
                <input type="password" value={cfg.apiKey} onChange={(e) => set({ apiKey: e.target.value })} placeholder={cfg.provider === "ollama" ? "none needed" : "paste key…"} autoComplete="off" /></div>
            </div>
          )}
          {(cfg.provider === "custom" || cfg.provider === "ollama") && (
            <div><label>Endpoint URL</label>
              <input value={cfg.baseUrl ?? ""} onChange={(e) => set({ baseUrl: e.target.value })} placeholder={endpointFor({ ...cfg, baseUrl: "" }) || "https://…/v1"} /></div>
          )}
          <div className="dossier-meta" style={{ marginTop: 8 }}>Every AI tale is Zod-checked before filing — broken output never ships; Mock is the eternal fallback.</div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" disabled={busy || !prompt.trim()} onClick={() => void run(false)}>
              <Icon name="spark" size={13} /> {busy ? "Compiling…" : `Compile with ${meta.label}`}
            </button>
            <button className="btn-ghost" disabled={busy || !prompt.trim()} onClick={() => void run(true)}>Stamp with Mock (no key)</button>
          </div>
          {error && <div style={{ color: "var(--red)", marginTop: 8 }}>{error}</div>}
          {preview && <div style={{ color: "var(--green)", marginTop: 8 }}>{preview}</div>}
        </div>
      </div>
    </div>
  );
}
