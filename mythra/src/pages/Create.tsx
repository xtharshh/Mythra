import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MockProvider } from "../ai/mockProvider";
import { PROVIDERS, endpointFor, envApiKeyFor, envApiKeysFor, generateWorldPlan, hasUsableKey, loadAIConfig, providerNeedsKey, saveAIConfig } from "../ai/providers";
import type { AIConfig, AIProviderId } from "../ai/providers";
import { validateWorld } from "../game/engines";
import type { Difficulty, World } from "../types";
import { useLumen } from "../state/store";
import { loadEntryChoice, loadSession, SESSION_EVENT } from "../auth/auth";
import { api, apiToken } from "../api/client";
import { Icon } from "../components/icons";
import { WorldPreviewModal, applyUserTitle } from "../components/WorldPreview";

/** Who owns the AI keys on this machine: signed-in explorer × online/offline. */
function aiScopeLabel(): { scope: string; owner: string; mode: string } {
  let owner = "guest";
  let mode = "offline";
  try {
    owner = loadSession()?.email?.trim() || "guest";
  } catch {
    /* headless */
  }
  try {
    mode = loadEntryChoice() ?? "offline";
  } catch {
    /* headless */
  }
  return { scope: `${owner}:${mode}`, owner, mode };
}

export default function Create() {
  const nav = useNavigate();
  const loc = useLocation();
  const { addWorld, pushLog } = useLumen();
  const [prompt, setPrompt] = useState("Create an abandoned Mars colony where players rebuild the habitat and find a hidden lab");
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [cfg, setCfg] = useState<AIConfig>(() => loadAIConfig());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewWorld, setPreviewWorld] = useState<{ world: World; minutes: number; via: string } | null>(null);
  const [pubBusy, setPubBusy] = useState(false);
  const [pubError, setPubError] = useState("");
  // after a 429 the provider needs a breather — cooldown stops retry-hammering
  const [limitedUntil, setLimitedUntil] = useState(0);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!limitedUntil) return;
    const id = window.setInterval(() => {
      if (Date.now() >= limitedUntil) {
        setLimitedUntil(0);
        window.clearInterval(id);
      } else {
        setTick((t) => t + 1);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [limitedUntil]);
  const limitedSecs = limitedUntil > Date.now() ? Math.ceil((limitedUntil - Date.now()) / 1000) : 0;
  const keyRef = useRef<HTMLInputElement>(null);
  const keyBlockRef = useRef<HTMLDivElement>(null);

  // keys are per-explorer + online/offline — reload when the login/mode changes
  const { scope: scopeId, owner: scopeOwner, mode: scopeMode } = aiScopeLabel();
  useEffect(() => {
    setCfg(loadAIConfig());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId]);
  useEffect(() => {
    const onSession = () => setCfg(loadAIConfig());
    window.addEventListener(SESSION_EVENT, onSession);
    return () => window.removeEventListener(SESSION_EVENT, onSession);
  }, []);

  // ?needKey=1 or #ai-key lands the explorer straight on the key field
  useEffect(() => {
    const q = new URLSearchParams(loc.search);
    if (q.get("needKey") === "1" || loc.hash === "#ai-key") {
      keyBlockRef.current?.scrollIntoView({ block: "center" });
      keyRef.current?.focus({ preventScroll: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta = PROVIDERS.find((p) => p.id === cfg.provider)!;
  const siteKey = envApiKeyFor(cfg.provider);
  const siteKeys = envApiKeysFor(cfg.provider);
  const needsKey = providerNeedsKey(cfg.provider);
  const missingKey = needsKey && !hasUsableKey(cfg);

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
    setBusy(true); setError("");
    try {
      const effective: AIConfig = useMock ? { provider: "mock", apiKey: "", model: "mock-1", keySource: "system" } : cfg;
      if (!useMock) saveAIConfig(cfg);
      const raw = useMock
        ? await new MockProvider().generateWorldPlan({
            prompt, difficulty, missionCount: 5, clueDensity: "medium", puzzleIntensity: "medium",
            allowConstruction: false, allowPlayerContributions: true,
          })
        : await generateWorldPlan({
            prompt, difficulty, missionCount: 5, clueDensity: "medium", puzzleIntensity: "medium",
            allowConstruction: false, allowPlayerContributions: true,
          }, effective);
      // your title stamps the tale; blank keeps the AI's name
      const world = applyUserTitle(raw, title);
      const report = validateWorld(world);
      if (!report.valid) {
        setError(`Expedition brief rejected: ${report.errors.slice(0, 3).map((e) => e.message).join(" | ")}`);
        return;
      }
      // the tale opens right here — approve or publish from the popup,
      // no Archive or Control detour
      setPubError("");
      setPreviewWorld({ world, minutes: report.estimatedMinutes, via: useMock ? "Mock" : meta.label });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Planner failed — brief preserved, retry.";
      setError(msg);
      if (/rate-limited/i.test(msg)) setLimitedUntil(Date.now() + 60000);
    } finally { setBusy(false); }
  };

  const approve = () => {
    if (!previewWorld) return;
    addWorld(structuredClone(previewWorld.world));
    pushLog(`Expedition filed: ${previewWorld.world.name} (via ${previewWorld.via})`);
    setPreviewWorld(null);
    nav("/play");
  };

  const publish = async () => {
    if (!previewWorld || pubBusy) return;
    if (!apiToken()) {
      setPubError("Sign in first (nav → Sign in) — publishing files under you.");
      return;
    }
    setPubBusy(true); setPubError("");
    try {
      addWorld(structuredClone(previewWorld.world));
      const r = await api.publish(previewWorld.world);
      if (!r) throw new Error("API unreachable — filed locally, retry publish online.");
      pushLog(`Published: ${previewWorld.world.name} — visible to every solver in the Archive.`);
      setPreviewWorld(null);
      nav("/play");
    } catch (e) {
      setPubError(e instanceof Error ? e.message : "Publish failed — filed locally.");
    } finally { setPubBusy(false); }
  };

  return (
    <div className="layout">
      <h2 className="case-title" style={{ fontSize: 34 }}>File a new <em>expedition.</em></h2>
      <p className="muted">Bring any AI key — or stamp it keyless with Mock.</p>
      {missingKey && (
        <div className="card" style={{ marginTop: 14, borderColor: "var(--amber)" }}>
          <div className="case-kicker">API key needed · {meta.label}</div>
          <div style={{ marginTop: 6 }}>
            {cfg.keySource === "system" && siteKeys.length === 0
              ? "No system key in env — flip to Custom below and add your own API key to create story. "
              : "No API key found — add your own API key below to create story. "}
            Filed under <b>{scopeOwner}</b> · {scopeMode} (this browser only).
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="btn"
              onClick={() => {
                set({ keySource: "custom" });
                window.setTimeout(() => {
                  keyBlockRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
                  keyRef.current?.focus({ preventScroll: true });
                }, 60);
              }}
            >
              <Icon name="plus" size={13} /> Add your key
            </button>
            <button className="btn-ghost" disabled={busy || !prompt.trim()} onClick={() => void run(true)}>Or stamp with Mock (no key)</button>
          </div>
        </div>
      )}
      <div className="console" style={{ marginTop: 14 }}>
        <div className="console-bar"><i style={{ background: "#ff5a5a" }} /><i style={{ background: "#fbbf24" }} /><i style={{ background: "#7ddf9a" }} /> Mythio PLANNER · DRAFT BRIEF</div>
        <div className="console-body">
          <section className="p-section">
            <div className="p-section-head"><span className="p-num">01</span><span className="case-kicker">The brief</span></div>
            <div className="field"><label>Story title (optional — blank lets the AI name it)</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The silent Mars colony" autoComplete="off" /></div>
            <div className="field"><label>Expedition brief</label>
              <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Tell the AI what story to forge…" /></div>
          </section>
          <section className="p-section">
            <div className="p-section-head"><span className="p-num">02</span><span className="case-kicker">The director</span></div>
            <div className="p-grid">
              <div className="field"><label>Hazard rating</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                  {(["beginner", "easy", "medium", "hard", "expert"] as Difficulty[]).map((d) => <option key={d} value={d}>{d}</option>)}
                </select></div>
              <div className="field"><label>AI director</label>
                <select value={cfg.provider} onChange={(e) => pickProvider(e.target.value as AIProviderId)}>
                  {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select></div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              {cfg.provider === "mock" || cfg.provider === "ollama" ? (
                <span className="pill green">No key needed</span>
              ) : siteKey ? (
                <span className="pill green" title="The host set a site key in env — your own key below overrides it">Site key set · yours overrides</span>
              ) : (
                <span className="pill amber">No site key — add yours below</span>
              )}
              <span className="dossier-meta">keys: {scopeOwner} · {scopeMode}</span>
            </div>
          </section>
          {cfg.provider !== "mock" && needsKey && (
            <section className="p-section">
              <div className="p-section-head"><span className="p-num">03</span><span className="case-kicker">The key</span></div>
              <div className="row">
                <button
                  className={cfg.keySource === "system" ? "btn" : "btn-ghost"}
                  style={{ padding: "4px 14px", fontSize: 12 }}
                  title="Use the host's site key from env (spares rotate on limits)"
                  onClick={() => set({ keySource: "system" })}
                >
                  System key
                </button>
                <button
                  className={cfg.keySource === "custom" ? "btn" : "btn-ghost"}
                  style={{ padding: "4px 14px", fontSize: 12 }}
                  title="Use only your own key, pasted below"
                  onClick={() => set({ keySource: "custom" })}
                >
                  Custom key
                </button>
                {cfg.keySource === "system" && (
                  siteKeys.length > 0
                    ? <span className="pill green">System active · {siteKeys.length} key{siteKeys.length === 1 ? "" : "s"} rotate on limits</span>
                    : <span className="pill amber">No system key in env</span>
                )}
              </div>
              {cfg.keySource === "custom" && (
                <div className="p-grid" style={{ marginTop: 10 }} ref={keyBlockRef} id="ai-key">
                  <div className="field"><label>Model</label>
                    <input value={cfg.model} onChange={(e) => set({ model: e.target.value })} placeholder={meta.defaultModel} /></div>
                  <div className="field"><label>{meta.keyName} — yours, this browser only</label>
                    <input ref={keyRef} type="password" value={cfg.apiKey} onChange={(e) => set({ apiKey: e.target.value })} placeholder="paste key…" autoComplete="off" /></div>
                </div>
              )}
              {(cfg.provider === "custom" || cfg.provider === "ollama") && (
                <div className="field"><label>Endpoint URL</label>
                  <input value={cfg.baseUrl ?? ""} onChange={(e) => set({ baseUrl: e.target.value })} placeholder={endpointFor({ ...cfg, baseUrl: "" }) || "https://…/v1"} /></div>
              )}
            </section>
          )}
          <section className="p-section p-compile">
            <div className="p-section-head"><span className="p-num">04</span><span className="case-kicker">Compile</span></div>
            <div className="dossier-meta">Every AI tale is Zod-checked before filing — broken output never ships; Mock is the eternal fallback. Site keys come from env, your key stays per-explorer ({scopeMode}).</div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" disabled={busy || !prompt.trim() || missingKey || limitedSecs > 0} title={missingKey ? "Add your own API key above to create story" : limitedSecs > 0 ? "Rate-limited — cooling down so retries don't extend it" : `Compile with ${meta.label}`} onClick={() => void run(false)}>
                <Icon name="spark" size={13} /> {busy ? "Compiling…" : limitedSecs > 0 ? `Limited — retry in ${limitedSecs}s` : `Compile with ${meta.label}`}
              </button>
              <button className="btn-ghost" disabled={busy || !prompt.trim()} onClick={() => void run(true)}>Stamp with Mock (no key)</button>
            </div>
            {error && <div style={{ color: "var(--red)", marginTop: 8 }}>{error}</div>}
          </section>
        </div>
      </div>
      {previewWorld && (
        <WorldPreviewModal
          world={previewWorld.world}
          minutes={previewWorld.minutes}
          busy={pubBusy}
          error={pubError}
          onApprove={approve}
          onPublish={() => void publish()}
          onClose={() => { setPreviewWorld(null); setPubError(""); }}
        />
      )}
    </div>
  );
}
