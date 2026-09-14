// World preview popup (Planner): the freshly compiled tale, fully opened —
// story, missions, clues, puzzles, cast and sites — with Approve (file it
// locally) or Publish (ship it to the Archive) right there. No detours.
import type { World } from "../types";
import { Icon } from "./icons";

/** Stamp the explorer's own title onto a compiled world. Empty = AI's name stands. Pure. */
export function applyUserTitle(world: World, title: string): World {
  const clean = title.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!clean) return world;
  const slug =
    `${clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "expedition"}-${Date.now().toString(36)}`;
  return {
    ...world,
    name: clean,
    slug,
    story: { ...world.story, title: clean },
    updatedAt: new Date().toISOString(),
  };
}

export function WorldPreviewModal({ world, minutes, busy, error, onApprove, onPublish, onClose }: {
  world: World;
  minutes: number;
  busy: boolean;
  error: string;
  onApprove: () => void;
  onPublish: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal card"
        style={{ width: "min(880px, 94vw)", maxHeight: "84vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="pill cyan">◉ compiled tale · reviewed + valid</span>
          <button className="btn-ghost" style={{ padding: "0 8px" }} title="Close preview" onClick={onClose}>✕</button>
        </div>
        <h2 className="case-title" style={{ fontSize: 30 }}>{world.name}</h2>
        <div className="dossier-meta">
          {world.missions.length} missions · {world.clues.length} clues · {world.puzzles.length} puzzles ·{" "}
          {world.locations.length} sites · {world.objects.length} objects · {world.characters.length} cast · est. {minutes} min
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <div className="case-kicker">The story</div>
          <div style={{ marginTop: 4 }}>{world.story.premise} {world.story.background}</div>
          <div className="muted" style={{ marginTop: 6 }}>Conflict: {world.story.centralConflict}</div>
          <div className="muted">You are {world.story.playerRole} — {world.story.tone}</div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
          <div className="card">
            <b>Missions</b>
            {world.missions.slice().sort((a, b) => a.order - b.order).map((m) => (
              <div key={m.id} style={{ marginTop: 6, fontSize: 13 }}>
                <span className="pill">{m.order}</span> <b>{m.title}</b>
                <div className="muted">{m.objectives.length} objectives · ~{m.estimatedMinutes} min</div>
              </div>
            ))}
          </div>
          <div className="card">
            <b>Clues</b>
            {world.clues.map((c) => (
              <div key={c.id} style={{ marginTop: 6, fontSize: 13 }}>
                <span className="pill amber">{c.type}</span> <b>{c.title}</b>
                <div className="muted">{c.text}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
          <div className="card">
            <b>Puzzles</b>
            {world.puzzles.map((p) => (
              <div key={p.id} style={{ marginTop: 6, fontSize: 13 }}>
                <span className="pill cyan">{p.type}</span> <b>{p.title}</b>
                <div className="muted">{p.hints.length} hints · {p.rewards.length} rewards</div>
              </div>
            ))}
          </div>
          <div className="card">
            <b>World</b>
            <div style={{ marginTop: 6, fontSize: 13 }}>
              <div><b>Sites:</b> {world.locations.map((l) => l.name).join(" · ") || "—"}</div>
              <div style={{ marginTop: 4 }}><b>Cast:</b> {world.characters.map((c) => c.name).join(" · ") || "—"}</div>
              <div style={{ marginTop: 4 }}><b>Supplies:</b> {world.resources.map((r) => r.name).join(" · ") || "—"}</div>
              <div style={{ marginTop: 4 }}><b>Endings:</b> {world.endings.map((e) => e.title).join(" · ") || "—"}</div>
            </div>
          </div>
        </div>

        {error && <div style={{ color: "var(--red)", marginTop: 10 }}>{error}</div>}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn btn-big" disabled={busy} onClick={onApprove}>
            <Icon name="check" size={14} /> {busy ? "Filing…" : "Approve — play it"}
          </button>
          <button className="btn-ghost" disabled={busy} title="File locally + ship to the Archive" onClick={onPublish}>
            <Icon name="signal" size={13} /> {busy ? "Shipping…" : "Publish to Archive"}
          </button>
          <button className="btn-ghost" disabled={busy} onClick={onClose}>Keep editing</button>
        </div>
        <div className="dossier-meta" style={{ marginTop: 8 }}>Approve files it under you and descends · Publish also needs sign-in (online).</div>
      </div>
    </div>
  );
}
