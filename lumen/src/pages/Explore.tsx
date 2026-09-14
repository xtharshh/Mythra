import { Link, useNavigate } from "react-router-dom";
import { forkWorld } from "../community/continuity";
import { useLumen } from "../state/store";
import demo from "../data/demo-world.json";
import type { World } from "../types";

export default function Explore() {
  const { worlds, world, addWorld, pushLog, contributions } = useLumen();
  const nav = useNavigate();
  const demoWorld = demo as unknown as World;

  const fork = (id: string) => {
    const src = worlds.find((w) => w.id === id);
    if (!src) return;
    const copy = forkWorld(src);
    addWorld(copy);
    pushLog(`🌱 New story forked from ${src.name}`);
    nav("/studio");
  };
  return (
    <div className="layout">
      <div className="case-kicker">◈ mission archive · {worlds.length} filed</div>
      <h2 className="case-title" style={{ fontSize: 34 }}>Expedition <em>records.</em></h2>
      <p className="muted">Every world is a case file. Open one, walk its dust, fork it into a new story.</p>
      <div className="grid" style={{ marginTop: 12 }}>
        <div className="card">
          <div className="row">
            <div className="planet-sigil" style={{ width: 64, height: 64 }} />
            <div>
              <b>{demoWorld.name}</b> <span className="stamp">demo · {demoWorld.difficulty}</span>
              <div className="muted" style={{ fontSize: 14 }}>{demoWorld.missions.length} missions · {demoWorld.clues.length} clues · {demoWorld.puzzles.length} puzzles · hidden lab</div>
              <div className="dossier-meta">SOL 442 · DUST STORM · GRAV 3.7</div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 8 }}><Link className="btn" to="/play">▼ Descend</Link></div>
        </div>
        {worlds.map((w) => {
          const chapters = (w.communityLog ?? []).length;
          const pending = contributions.filter((c) => c.worldId === w.id && c.status === "pending").length;
          return (
            <div className="card" key={w.id}>
              <div className="case-kicker">file {w.slug} · v{w.version}</div>
              <b>{w.name}</b> <span className="pill">{w.difficulty}</span> <span className="pill">{w.status}</span>
              <div className="muted" style={{ fontSize: 14 }}>{w.missions.length} missions · {w.clues.length} clues · {w.puzzles.length} puzzles</div>
              <div className="dossier-meta">📖 {chapters} chapter{chapters === 1 ? "" : "s"}{pending > 0 ? ` · ⏳ ${pending} awaiting review` : ""} {w.id === world?.id ? "· ● active file" : ""}</div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn-ghost" onClick={() => fork(w.id)}>🌱 Fork new story</button>
              </div>
            </div>
          );
        })}
      </div>
      {worlds.length === 0 && <p className="muted" style={{ marginTop: 12 }}>No filed expeditions yet — the Mars demo above is always walkable.</p>}
    </div>
  );
}
