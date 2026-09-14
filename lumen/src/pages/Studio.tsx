import { useMemo, useState } from "react";
import { validateWorld } from "../game/engines";
import { useLumen } from "../state/store";
import { ApprovalQueue, VersionsPanel } from "../components/Community";

// Creator Studio as mission control (§17): console tabs, validation stamp, test bench.
export default function Studio() {
  const { world, updateWorld, pushLog, publishWorld, unpublishWorld } = useLumen();
  const [tab, setTab] = useState<"missions" | "clues" | "story" | "versions" | "validate" | "test">("missions");
  const report = useMemo(() => (world ? validateWorld(world) : null), [world]);
  if (!world) return <div className="layout"><div className="case-kicker">◈ mission control · offline</div><h2 className="case-title" style={{ fontSize: 34 }}>No file <em>loaded.</em></h2><p className="muted">Open the <a href="/play">Mars demo</a> or <a href="/create">file an expedition</a> first.</p></div>;

  return (
    <div className="layout">
      <div className="case-kicker">◈ mission control · {world.slug} · v{world.version}</div>
      <h2 className="case-title" style={{ fontSize: 34 }}>Flight <em>control.</em></h2>
      <div className="row" style={{ marginTop: 6 }}>
        {(["missions", "clues", "story", "versions", "validate", "test"] as const).map((t) => (
          <button key={t} className={tab === t ? "btn" : "btn-ghost"} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === "missions" && (
        <div className="grid" style={{ marginTop: 12 }}>
          {world.missions.map((m) => (
            <div className="card" key={m.id}>
              <div className="case-kicker">ops order {m.order} · {m.id}</div>
              <label>Mission title</label>
              <input defaultValue={m.title} onBlur={(e) => {
                if (!e.target.value.trim() || e.target.value === m.title) return;
                updateWorld({ ...world, missions: world.missions.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)), updatedAt: new Date().toISOString() });
                pushLog(`Edited mission: ${m.id}`);
              }} />
              <div className="dossier-meta" style={{ marginTop: 6 }}>{m.objectives.length} objectives · {m.optional ? "optional" : "required"} · {m.estimatedMinutes} min</div>
            </div>
          ))}
        </div>
      )}
      {tab === "clues" && (
        <div className="grid" style={{ marginTop: 12 }}>
          {world.clues.map((c) => (
            <div className="card" key={c.id}>
              <div className="case-kicker">evidence · {c.id}</div>
              <label>Clue text</label>
              <textarea rows={3} defaultValue={c.text} onBlur={(e) => {
                if (!e.target.value.trim() || e.target.value === c.text) return;
                updateWorld({ ...world, clues: world.clues.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)), updatedAt: new Date().toISOString() });
                pushLog(`Edited clue: ${c.id}`);
              }} />
              <div className="dossier-meta">{c.importance} · {c.type} · {c.optional ? "optional" : "required"}</div>
            </div>
          ))}
        </div>
      )}
      {tab === "story" && (
        <div style={{ marginTop: 12 }}>
          <ApprovalQueue world={world} />
        </div>
      )}
      {tab === "versions" && <VersionsPanel world={world} />}
      {tab === "validate" && report && (
        <div className="console" style={{ marginTop: 12 }}>
          <div className="console-bar">Publish stamp · {report.valid ? "VALID" : "INVALID"}</div>
          <div className="console-body">
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="stamp">{world.status === "published" ? "open to solvers" : "draft"}</span>
              {world.status === "published"
                ? <button className="btn-ghost" onClick={() => { unpublishWorld(); }}>Unpublish</button>
                : <button className="btn" disabled={!report.valid} title={report.valid ? "List this tale in the Archive for every solver" : "Fix validation errors first"} onClick={() => { publishWorld(); }}>Publish to Archive</button>}
            </div>
            <div className="dossier-meta">{report.missionCount} missions · {report.clueCount} clues · {report.puzzleCount} puzzles · est. {report.estimatedMinutes} min · {report.reachableLocations}/{report.reachableLocations + report.unreachableLocations} reachable</div>
            {report.errors.map((e, i) => <div key={i} style={{ color: "var(--red)", fontSize: 13 }}>⛔ {e.code}: {e.message}</div>)}
            {report.warnings.map((e, i) => <div key={i} style={{ color: "var(--amber)", fontSize: 13 }}>⚠ {e.code}: {e.message}</div>)}
            {report.suggestions.map((e, i) => <div key={i} className="muted" style={{ fontSize: 13 }}>💡 {e.code}: {e.message}</div>)}
            {report.valid && <div style={{ color: "var(--green)", marginTop: 6 }}>✔ Publish check passed (local draft).</div>}
          </div>
        </div>
      )}
      {tab === "test" && <TestTools />}
    </div>
  );
}

function TestTools() {
  const s = useLumen();
  return (
    <div className="console" style={{ marginTop: 12 }}>
      <div className="console-bar">Test bench · creator-only</div>
      <div className="console-body">
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn-ghost" onClick={() => { s.world?.clues.forEach((c) => s.discoverClue(c.id)); s.pushLog("Test: revealed all clues"); }}>Reveal all clues</button>
          <button className="btn-ghost" onClick={() => { s.collect("metal", 10); s.collect("circuit", 5); s.collect("energy_cell", 3); s.pushLog("Test: granted resources"); }}>Grant resources</button>
          <button className="btn-ghost" onClick={() => { s.world?.locations.forEach((l) => s.reachLocation(l.id)); s.pushLog("Test: teleported everywhere"); }}>Unlock all locations</button>
          <button className="btn-ghost" onClick={() => { s.reset(); }}>Reset world</button>
        </div>
      </div>
    </div>
  );
}
