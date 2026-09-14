import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forkWorld } from "../community/continuity";
import { exportWorldCode, importWorldCode } from "../game/share";
import { useLumen } from "../state/store";
import { Leaderboard } from "../components/Leaderboard";
import { Icon } from "../components/icons";
import type { Difficulty, World } from "../types";
import demo from "../data/demo-world.json";

const demoWorld = demo as unknown as World;
type Sort = "featured" | "plays" | "rating" | "newest" | "name";

function avg(r: { total: number; count: number } | undefined): number {
  if (!r || r.count === 0) return 0;
  return r.total / r.count;
}

function Stars({ value, onRate }: { value: number; onRate?: (n: number) => void }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          className="btn-ghost"
          style={{ padding: "0 4px", opacity: onRate ? 1 : 0.85 }}
          title={onRate ? `Rate ${n}/5` : `${value.toFixed(1)}/5`}
          disabled={!onRate}
          onClick={() => onRate?.(n)}
        >
          <span style={{ color: n <= Math.round(value) ? "var(--th-accent)" : "var(--muted)" }}>★</span>
        </button>
      ))}
    </span>
  );
}

export default function Explore() {
  const { worlds, world, addWorld, setWorld, pushLog, contributions, plays, ratings, rateWorld, loadSocial } = useLumen();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [diff, setDiff] = useState<"all" | Difficulty>("all");
  const [sort, setSort] = useState<Sort>("featured");
  const [code, setCode] = useState("");
  const [importErr, setImportErr] = useState("");
  const [exportFor, setExportFor] = useState<string | null>(null);

  useMemo(() => { loadSocial(); }, [loadSocial]);

  const all: World[] = useMemo(() => {
    const mine = worlds.filter((w) => w.id !== demoWorld.id);
    return [demoWorld, ...mine];
  }, [worlds]);

  const feed = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = all.filter((w) => {
      if (diff !== "all" && w.difficulty !== diff) return false;
      if (needle && !`${w.name} ${w.description} ${w.theme}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const score = (w: World) => avg(ratings[w.id]);
    list = list.slice().sort((a, b) => {
      switch (sort) {
        case "plays": return (plays[b.id] ?? 0) - (plays[a.id] ?? 0);
        case "rating": return score(b) - score(a);
        case "newest": return b.updatedAt.localeCompare(a.updatedAt);
        case "name": return a.name.localeCompare(b.name);
        default: {
          // featured: published first, then plays, then rating
          const pa = a.status === "published" || a.id === demoWorld.id ? 0 : 1;
          const pb = b.status === "published" || b.id === demoWorld.id ? 0 : 1;
          return pa - pb || (plays[b.id] ?? 0) - (plays[a.id] ?? 0) || score(b) - score(a);
        }
      }
    });
    return list;
  }, [all, q, diff, sort, plays, ratings]);

  const enter = (w: World) => {
    if (w.id !== demoWorld.id && !worlds.some((x) => x.id === w.id)) addWorld(structuredClone(w));
    else if (w.id === demoWorld.id && !world) setWorld(structuredClone(demoWorld));
    else setWorld(structuredClone(w));
    nav("/play");
  };

  const fork = (id: string) => {
    const src = id === demoWorld.id ? demoWorld : worlds.find((w) => w.id === id);
    if (!src) return;
    const copy = forkWorld(structuredClone(src));
    addWorld(copy);
    pushLog(`New story forked from ${src.name}`);
    nav("/studio");
  };

  const doImport = () => {
    setImportErr("");
    try {
      const w = importWorldCode(code);
      addWorld(w);
      pushLog(`Imported story: ${w.name} — publish it to share with solvers.`);
      setCode("");
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : "Import failed.");
    }
  };

  return (
    <div className="layout">
      <div className="case-kicker">◈ story archive · every published tale, ready to solve</div>
      <h2 className="case-title" style={{ fontSize: 34 }}>Find a <em>mystery.</em></h2>
      <p className="muted">Publish a story and it lands here for every solver — plays and ratings included. Carry tales between deployments with share codes.</p>

      <div className="console" style={{ marginTop: 14 }}>
        <div className="console-bar">Archive index · search · filter · carry</div>
        <div className="console-body">
          <div className="row">
            <div style={{ flex: "2 1 220px" }}><label>Search tales</label>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="mars, ridge, haunted…" /></div>
            <div style={{ flex: "1 1 140px" }}><label>Hazard</label>
              <select value={diff} onChange={(e) => setDiff(e.target.value as "all" | Difficulty)}>
                <option value="all">any</option>
                {(["beginner", "easy", "medium", "hard", "expert"] as Difficulty[]).map((d) => <option key={d} value={d}>{d}</option>)}
              </select></div>
            <div style={{ flex: "1 1 140px" }}><label>Order</label>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="featured">featured</option>
                <option value="plays">most played</option>
                <option value="rating">top rated</option>
                <option value="newest">newest</option>
                <option value="name">name</option>
              </select></div>
          </div>
          <label>Carry a tale here (paste share code)</label>
          <div className="row">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="paste export code…" style={{ flex: 1 }} />
            <button className="btn" disabled={!code.trim()} onClick={doImport}><Icon name="plus" /> Import</button>
          </div>
          {importErr && <div style={{ color: "var(--red)", fontSize: 13, marginTop: 6 }}>{importErr}</div>}
        </div>
      </div>

      <div className="grid" style={{ marginTop: 16 }}>
        {feed.map((w) => {
          const chapters = (w.communityLog ?? []).length;
          const pending = contributions.filter((c) => c.worldId === w.id && c.status === "pending").length;
          const isDemo = w.id === demoWorld.id;
          const published = isDemo || w.status === "published";
          const r = ratings[w.id];
          const exported = exportFor === w.id ? exportWorldCode(w) : null;
          return (
            <div className="card" key={w.id}>
              <div className="row">
                <div className="planet-sigil" style={{ width: 56, height: 56, background: `radial-gradient(circle at 32% 30%, ${w.environment.primaryColor} 0%, ${w.environment.fogColor} 55%, #140a06 100%)` }} />
                <div>
                  <b>{w.name}</b>{" "}
                  <span className="stamp">{published ? "open to solvers" : "draft · only you"}</span>
                  <div className="muted" style={{ fontSize: 13 }}>{w.theme} · {w.difficulty} · {w.missions.length} missions · {w.clues.length} clues · {w.puzzles.length} puzzles</div>
                  <div className="dossier-meta">
                    <Icon name="play" size={11} /> {plays[w.id] ?? 0} plays · <Icon name="book" size={11} /> {chapters} chapters
                    {pending > 0 ? ` · ${pending} awaiting review` : ""} {w.id === world?.id ? "· active file" : ""}
                  </div>
                  <div className="row" style={{ marginTop: 4 }}>
                    <Stars value={r?.mine ?? avg(r)} onRate={(n) => rateWorld(w.id, n)} />
                    <span className="dossier-meta">{r && r.count > 0 ? `${avg(r).toFixed(1)} (${r.count})` : "unrated"}</span>
                  </div>
                </div>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn" onClick={() => enter(w)}><Icon name="play" /> Enter</button>
                <button className="btn-ghost" onClick={() => fork(w.id)}><Icon name="fork" /> Fork</button>
                <button className="btn-ghost" onClick={() => setExportFor(exportFor === w.id ? null : w.id)}>Carry</button>
              </div>
              {exported && (
                <div style={{ marginTop: 8 }}>
                  <label>Share code — paste it into any Archive</label>
                  <textarea rows={3} readOnly value={exported} onFocus={(e) => e.target.select()} style={{ fontSize: 11 }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {feed.length === 0 && <p className="muted" style={{ marginTop: 12 }}>No tales match — loosen the search, or <Link to="/create">file a new expedition</Link>.</p>}

      <div style={{ marginTop: 16 }}>
        <Leaderboard worldId={(world ?? demoWorld).id} worldName={(world ?? demoWorld).name} />
      </div>
    </div>
  );
}
