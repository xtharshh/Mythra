import { Link } from "react-router-dom";
import demo from "../data/demo-world.json";
import type { World } from "../types";
import { themeForWorld } from "../theme/theme";
import { SupportButton } from "../components/Support";

const world = demo as unknown as World;

export default function Landing() {
  const theme = themeForWorld(world);
  return (
    <div className="layout">
      <div className="case-kicker">Welcome to MYTHRA.</div>
      <div className="case-kicker" style={{ marginTop: 4 }}>◉ incoming transmission · {theme.sol} · {theme.station}</div>
      <div className="row" style={{ alignItems: "flex-start", marginTop: 14 }}>
        <div style={{ flex: "1 1 420px" }}>
          <h1 className="case-title">The silent<br /><em>Mars colony.</em></h1>
          <p style={{ fontSize: 17, lineHeight: 1.6, maxWidth: 560 }}>
            {world.story.premise} {world.story.background} You are {world.story.playerRole}
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            {world.story.knownFacts.map((f) => <span key={f} className="stamp">{f}</span>)}
          </div>
          <div className="row" style={{ marginTop: 18 }}>
            <Link className="btn btn-big" to="/play">▼ Begin descent</Link>
            <Link className="btn-ghost" to="/create">Expedition planner</Link>
            <Link className="btn-ghost" to="/explore">Mission archive</Link>
            <SupportButton />
          </div>
          <div className="dossier-meta" style={{ marginTop: 14 }}>
            CASE {world.slug} · {world.missions.length} missions · {world.clues.length} clues · {world.puzzles.length} puzzles · hidden lab · est. {world.missions.reduce((s, m) => s + m.estimatedMinutes, 0)} min
          </div>
        </div>
        <div style={{ flex: "0 0 auto", textAlign: "center" }}>
          <div className="planet-sigil" role="img" aria-label="Mars" />
          <div className="dossier-meta" style={{ marginTop: 8 }}>GRAV 3.7 · AIR THIN<br />WX DUST STORM</div>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 26 }}>
        <div className="card">
          <div className="case-kicker">Field log 01</div>
          <b>🔍 Investigate the silence</b>
          <div className="muted" style={{ marginTop: 6 }}>Walk Aurora Base, inspect the rover, play the helmet recording, fill the clue journal. Sol 442 went quiet mid-sentence.</div>
          <div className="dossier-meta" style={{ marginTop: 8 }}>8+ clues · recorder · nav console</div>
        </div>
        <div className="card">
          <div className="case-kicker">Field log 02</div>
          <b>🧩 Earn the ridge code</b>
          <div className="muted" style={{ marginTop: 6 }}>Solar sequence 4-2-1-3, hunter glyphs, hatch keypad. The maintenance note and the song disagree — trust both.</div>
          <div className="dossier-meta" style={{ marginTop: 8 }}>3 puzzles · hints on radio</div>
        </div>
        <div className="card">
          <div className="case-kicker">Field log 03</div>
          <b>🛠 Rebuild to survive</b>
          <div className="muted" style={{ marginTop: 6 }}>Salvage 4 metal and 2 circuits, repair the habitat panel, restore the array, take the flight suit skyward.</div>
          <div className="dossier-meta" style={{ marginTop: 8 }}>scrap · drone · locker · chime</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="case-kicker">Central conflict</div>
        <div style={{ fontSize: 16, marginTop: 6 }}>{world.story.centralConflict}</div>
        <div className="muted" style={{ marginTop: 6 }}>Loop: surface → clue → resource → puzzle → mission → hidden ridge → the truth below.</div>
      </div>
    </div>
  );
}
