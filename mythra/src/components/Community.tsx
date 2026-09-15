// Community continuity UI (§18–19): continue the SAME story via contributions,
// or fork a NEW story. Respects world permissions + contribution mode.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CONTRIBUTION_LIMITS,
  chapterNumber,
  forkWorld,
  kindAllowed,
  makeContribution,
  nearestLocation,
  resolveContributionTitle,
  validateContribution,
} from "../community/continuity";
import type { ContributionKind, World } from "../types";
import { useLumen } from "../state/store";
import { PROVIDERS, draftChapter, loadAIConfig } from "../ai/providers";
import { DictateButton, VoiceNotes } from "./VoiceNotes";
import { explorerName } from "../game/credits";
import { Icon } from "./icons";
import { loadVoiceSettings, speak } from "../audio/voice";

const KIND_LABELS: Record<ContributionKind, string> = {
  clue: "Clue",
  note: "Field note",
  story_fragment: "Story chapter",
  mission_idea: "Mission idea",
};

/* ---------------- Contribute: extend the active story ---------------- */
export function ContributeModal({ world, onClose }: { world: World; onClose: () => void }) {
  const { contributions, submitContribution, playerPos } = useLumen();
  const allowed = (Object.keys(KIND_LABELS) as ContributionKind[]).filter((k) => kindAllowed(k, world.permissions));
  const [kind, setKind] = useState<ContributionKind>(allowed[0] ?? "clue");
  // permissions can open mid-session (Control toggles) — follow them live
  const safeKind = allowed.includes(kind) ? kind : (allowed[0] ?? "clue");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [mission, setMission] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [idea, setIdea] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftErr, setDraftErr] = useState("");
  const here = nearestLocation(playerPos, world.locations);
  const filedAs = resolveContributionTitle(title, text);
  const aiLabel = (PROVIDERS.find((p) => p.id === loadAIConfig().provider) ?? PROVIDERS[0]).label;

  const draftWithAI = async () => {
    setDraftErr("");
    if (!idea.trim() || drafting) return;
    setDrafting(true);
    try {
      const entries = (world.communityLog ?? []).slice(-3).map((e) => ({ title: e.title, text: e.text }));
      const d = await draftChapter(loadAIConfig(), {
        taleName: world.name,
        premise: world.story.premise,
        background: world.story.background,
        recentChapters: entries,
        kind: safeKind,
        idea,
      });
      setTitle(d.title);
      setText(d.text);
    } catch (e) {
      setDraftErr(e instanceof Error ? e.message : "Drafting failed — your words still stand.");
    } finally {
      setDrafting(false);
    }
  };

  if (allowed.length === 0) {
    return (
      <div className="modal-back" onClick={onClose}>
        <div className="modal card" onClick={(e) => e.stopPropagation()}>
          <b>Story closed to contributions</b>
          <p className="muted">The creator hasn't opened this story for continuations yet.</p>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const submit = () => {
    const author = explorerName(); // signed-in username, else guest explorer
    const draft = {
      kind: safeKind,
      title,
      text,
      targetMissionId: mission || undefined,
      targetLocationId: location || undefined,
    };
    const check = validateContribution(draft, world, contributions, author);
    if (!check.ok) { setError(check.error); return; }
    const autoApprove = world.permissions.contributionMode === "open";
    submitContribution(makeContribution(draft, world.id, author, autoApprove));
    setDone(autoApprove ? "✔ Published — read it in Journal → Chapters, and look for its new objects standing in the world!" : "✉ Sent for review — approve it in Control → Awaiting review and it becomes a chapter.");
    setError("");
    setTitle(""); setText("");
    setTimeout(onClose, 1200);
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <b>Continue this story</b>
        <p className="muted" style={{ fontSize: 13 }}>
          Add a {KIND_LABELS[safeKind].toLowerCase()} to “{world.name}” as <b>{explorerName()}</b>.
          {world.permissions.contributionMode === "open" ? " It publishes instantly." : " The creator reviews it first."}
        </p>
        <label>Kind</label>
        <select value={safeKind} onChange={(e) => setKind(e.target.value as ContributionKind)}>
          {allowed.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </select>
        <div className="row" style={{ marginTop: 8 }}>
          <div style={{ flex: 1 }}><label>Idea seed — the AI drafts your chapter from this</label>
            <input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="e.g. the rover's headlights flicker twice…" autoComplete="off" /></div>
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <button className="btn-ghost" disabled={drafting || !idea.trim()} title={`Draft with ${aiLabel} — fills title + text, you keep the pen`} onClick={() => void draftWithAI()}>
            <Icon name="spark" size={13} /> {drafting ? "AI is writing…" : `Draft with ${aiLabel}`}
          </button>
        </div>
        {draftErr && <div style={{ color: "var(--red)", fontSize: 13, marginTop: 6 }}>{draftErr}</div>}
        <label>Title (optional — blank lets the story name it from your text)</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. A second set of footprints — or leave blank" />
        {text.trim().length >= CONTRIBUTION_LIMITS.textMin && (
          <div className="dossier-meta" style={{ marginTop: 4 }}>
            Filed as: <b style={{ color: "var(--th-accent)" }}>{filedAs}</b>
          </div>
        )}
        {safeKind !== "story_fragment" && (
          <>
            <label>Link to mission (optional)</label>
            <select value={mission} onChange={(e) => setMission(e.target.value)}>
              <option value="">— none —</option>
              {world.missions.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </>
        )}
        {safeKind === "clue" && (
          <>
            <label>Found at location</label>
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">— landing zone —</option>
              {world.locations.filter((l) => !l.locked).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </>
        )}
        {(safeKind === "note" || safeKind === "story_fragment" || safeKind === "mission_idea") && (
          <>
            <label>Pin to location (optional — defaults to where you stand)</label>
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">— where I'm standing{here ? `: ${here.name}` : ""} —</option>
              {world.locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.locked ? " (sealed)" : ""}</option>)}
            </select>
          </>
        )}
        {here && (
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn-ghost" style={{ padding: "2px 10px" }} title="Pin this contribution to your current spot" onClick={() => setLocation(here.id)}>
              <Icon name="pin" size={12} /> Use where I'm standing · {here.name} ({here.dist.toFixed(0)}m)
            </button>
          </div>
        )}
        <label>Text ({CONTRIBUTION_LIMITS.textMin}–{CONTRIBUTION_LIMITS.textMax} chars — room for a full 50-minute chapter)</label>
        <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write what the next explorer should find…" />
        <div className="row" style={{ marginTop: 6 }}>
          <DictateButton onText={(t) => setText((v) => `${v} ${t}`.trim())} />
          <span className="muted" style={{ fontSize: 12 }}>Dictate it, or attach voice after submit via Chapters → 🎙️ Narrate.</span>
        </div>
        {safeKind === "clue" && (
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Tip: after submitting, open the Journal → that clue → 🎙️ Narrate to tell it in your own voice.
          </div>
        )}
        {error && <div style={{ color: "var(--red)", fontSize: 13, marginTop: 6 }}>{error}</div>}
        {done && <div style={{ color: "var(--green)", fontSize: 13, marginTop: 6 }}>{done}</div>}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={submit}>Submit</button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Chapters: the story so far (canon + community) ---------------- */
export function ChaptersPanel({ world }: { world: World }) {
  const pending = useLumen((s) => s.contributions.filter((c) => c.worldId === world.id && c.status === "pending"));
  const entries = world.communityLog ?? [];
  if (entries.length === 0 && pending.length === 0) return null;
  const narrate = (title: string, text: string) => {
    const s = loadVoiceSettings();
    speak(`${title}. ${text}`, { ...s, enabled: true });
  };
  return (
    <div className="hud-panel">
      <b>Continued by explorers</b>
      {pending.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span className="pill amber">awaiting review · not a chapter yet</span>
          {pending.map((c) => (
            <div key={c.id} style={{ marginTop: 6, fontSize: 13 }}>
              <span className="pill">{KIND_LABELS[c.kind]}</span> <b>{c.title}</b>
              <div>{c.text}</div>
              <div className="muted">— {c.author} · approve it in Control → Awaiting review</div>
            </div>
          ))}
        </div>
      )}
      {entries.map((e, i) => (
        <div key={e.id} style={{ marginTop: 8, fontSize: 13 }}>
          <span className="pill cyan">{chapterNumber(i)}</span> <span className="pill">{KIND_LABELS[e.kind]}</span> <b>{e.title}</b>
          <div>{e.text}</div>
          <div className="muted">— {e.author}</div>
          <div className="row" style={{ marginTop: 4 }}>
            <button className="btn-ghost" style={{ padding: "2px 8px" }} title="Hear this chapter (TTS)" onClick={() => narrate(e.title, e.text)}>🔊</button>
          </div>
          <VoiceNotes worldId={world.id} targetKind="chapter" targetId={e.id} label={e.title} compact />
        </div>
      ))}
    </div>
  );
}

/* ---------------- Chapters reader: same story, every chapter ---------------- */
export function ChaptersReaderModal({ world, onClose, onOpenTale }: { world: World; onClose: () => void; onOpenTale: () => void }) {
  const entries = world.communityLog ?? [];
  const narrate = (title: string, text: string) => {
    const s = loadVoiceSettings();
    speak(`${title}. ${text}`, { ...s, enabled: true });
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal card" style={{ width: "min(640px, 94vw)", maxHeight: "84vh", overflow: "auto", position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <button className="btn-ghost" style={{ position: "absolute", top: 22, right: 10, padding: "0 8px" }} title="Close chapters" onClick={onClose}>✕</button>
        <div className="case-kicker">◈ same story · continued by explorers</div>
        <h3 style={{ margin: "8px 0 4px" }}>{world.name} · {entries.length} chapter{entries.length === 1 ? "" : "s"}</h3>
        <p className="muted" style={{ fontSize: 13 }}>{world.story.premise}</p>
        {entries.map((e, i) => (
          <div key={e.id} style={{ marginTop: 10, fontSize: 13, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            <span className="pill cyan">{chapterNumber(i)}</span> <span className="pill">{KIND_LABELS[e.kind]}</span> <b>{e.title}</b>
            <div style={{ marginTop: 4 }}>{e.text}</div>
            <div className="muted">— {e.author}</div>
            <div className="row" style={{ marginTop: 4 }}>
              <button className="btn-ghost" style={{ padding: "2px 8px" }} title="Hear this chapter (TTS)" onClick={() => narrate(e.title, e.text)}>🔊 Narrate</button>
            </div>
          </div>
        ))}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" onClick={onOpenTale}><Icon name="play" size={13} /> Open tale</button>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Studio: approval queue + permission gates ---------------- */
export function ApprovalQueue({ world }: { world: World }) {
  const { contributions, reviewContribution, updateWorld } = useLumen();
  const queue = contributions.filter((c) => c.worldId === world.id && c.status === "pending");
  const history = contributions.filter((c) => c.worldId === world.id && c.status !== "pending");

  const toggle = (key: "allowClueCreation" | "allowStoryChanges" | "allowMissionCreation") => {
    updateWorld({ ...world, permissions: { ...world.permissions, [key]: !world.permissions[key] }, updatedAt: new Date().toISOString() });
  };

  return (
    <div>
      <div className="card">
        <b>Who may continue this story?</b>
        <div className="row" style={{ marginTop: 8 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={world.permissions.allowClueCreation} onChange={() => toggle("allowClueCreation")} /> clues & notes
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={world.permissions.allowStoryChanges} onChange={() => toggle("allowStoryChanges")} /> story chapters
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={world.permissions.allowMissionCreation} onChange={() => toggle("allowMissionCreation")} /> mission ideas
          </label>
        </div>
        <label>Review mode</label>
        <select
          value={world.permissions.contributionMode}
          onChange={(e) => updateWorld({ ...world, permissions: { ...world.permissions, contributionMode: e.target.value as World["permissions"]["contributionMode"] }, updatedAt: new Date().toISOString() })}
        >
          <option value="approval_required">Approve each one (recommended)</option>
          <option value="open">Publish instantly</option>
          <option value="owner_only">No contributions</option>
        </select>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <b>Awaiting review</b> <span className="pill">{queue.length}</span>
        {queue.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Queue empty — new player continuations appear here.</div>}
        {queue.map((c) => (
          <div key={c.id} style={{ marginTop: 10, fontSize: 13, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            <span className="pill amber">{KIND_LABELS[c.kind]}</span> <b>{c.title}</b>
            <span className="muted"> by {c.author}</span>
            <div>{c.text}</div>
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn" onClick={() => reviewContribution(c.id, true)}>Approve → continues story (v{world.version + 1})</button>
              <button className="btn-ghost" onClick={() => reviewContribution(c.id, false)}>Reject</button>
            </div>
          </div>
        ))}
      </div>
      {history.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <b>Reviewed</b>
          {history.map((c) => (
            <div key={c.id} className="muted" style={{ fontSize: 13 }}>{c.status === "approved" ? "✔" : "✖"} {c.title} <span className="pill">{KIND_LABELS[c.kind]}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Studio: version history + rollback + fork ---------------- */
export function VersionsPanel({ world }: { world: World }) {
  const { versions, rollbackToVersion, addWorld, pushLog } = useLumen();
  const nav = useNavigate();
  const list = versions.filter((v) => v.worldId === world.id).slice().sort((a, b) => b.versionNumber - a.versionNumber);

  const fork = () => {
    const copy = forkWorld(world);
    addWorld(copy);
    pushLog(`🌱 New story forked: ${copy.name}`);
    nav("/studio");
  };

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <b>Versions</b> <span className="pill">current v{world.version}</span>
      <div className="muted" style={{ fontSize: 13 }}>Every approved continuation snapshots a version. Roll back any time.</div>
      {list.length === 0 && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>No snapshots yet — approve a contribution or edit to create history.</div>}
      {list.map((v) => (
        <div key={v.id} className="row" style={{ marginTop: 8, fontSize: 13 }}>
          <span className="pill">v{v.versionNumber}</span>
          <span>{v.changeSummary}</span>
          <span className="muted">{v.createdBy}</span>
          <button className="btn-ghost" onClick={() => rollbackToVersion(v.versionNumber)}>Roll back</button>
        </div>
      ))}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={fork}>🌱 Fork into a NEW story</button>
      </div>
    </div>
  );
}

