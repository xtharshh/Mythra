import { Link } from "react-router-dom";
import demo from "../data/demo-world.json";
import type { World } from "../types";
import { SupportButton } from "../components/Support";
import { Icon } from "../components/icons";
import type { IconName } from "../components/icons";

const world = demo as unknown as World;

const LOGS: { kicker: string; icon: IconName; title: string; body: string; meta: string }[] = [
  {
    kicker: "Field log 01",
    icon: "search",
    title: "Investigate the silence",
    body: "Walk Aurora Base, inspect the rover, play the helmet recording, fill the clue journal.",
    meta: "8+ clues · recorder · nav console",
  },
  {
    kicker: "Field log 02",
    icon: "puzzle",
    title: "Earn the ridge code",
    body: "Solar sequence, hunter glyphs, hatch keypad. The note and the song disagree — trust both.",
    meta: "3 puzzles · hints on radio",
  },
  {
    kicker: "Field log 03",
    icon: "wrench",
    title: "Rebuild to survive",
    body: "Salvage metal and circuits, repair the habitat, restore the array, take the flight suit skyward.",
    meta: "scrap · drone · locker · chime",
  },
];

export default function Landing() {
  return (
    <div className="layout">
      <div className="row" style={{ alignItems: "flex-start", marginTop: 14 }}>
        <div style={{ flex: "1 1 420px" }}>
          <h1 className="case-title">The silent<br /><em>Mars colony.</em></h1>
          <p style={{ fontSize: 17, lineHeight: 1.6, maxWidth: 560 }}>
            {world.story.premise} {world.story.background} You are {world.story.playerRole}
          </p>
          <div className="row" style={{ marginTop: 18 }}>
            <Link className="btn btn-big" to="/play"><Icon name="play" size={15} /> Play</Link>
            <Link className="btn-ghost" to="/create">Make a story</Link>
            <Link className="btn-ghost" to="/explore">Browse stories</Link>
            <SupportButton />
          </div>
          <div className="dossier-meta" style={{ marginTop: 12 }}>
            {world.missions.length} missions · {world.clues.length} clues · {world.puzzles.length} puzzles · hidden lab · est. {world.missions.reduce((s, m) => s + m.estimatedMinutes, 0)} min
          </div>
        </div>
        <div style={{ flex: "0 0 auto", textAlign: "center" }}>
          <div className="planet-sigil" role="img" aria-label="Mars" />
        </div>
      </div>

      <div className="grid" style={{ marginTop: 26 }}>
        {LOGS.map((l) => (
          <div className="card" key={l.kicker}>
            <div className="case-kicker">{l.kicker}</div>
            <div className="row" style={{ gap: 8, marginTop: 4 }}>
              <span style={{ color: "var(--th-accent)", display: "inline-flex" }}><Icon name={l.icon} size={18} /></span>
              <b style={{ fontSize: 16 }}>{l.title}</b>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>{l.body}</div>
            <div className="dossier-meta" style={{ marginTop: 8 }}>{l.meta}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 8 }}>
          <span style={{ color: "var(--th-accent)", display: "inline-flex" }}><Icon name="book" size={16} /></span>
          <div>
            <div className="case-kicker">Central conflict</div>
            <div style={{ fontSize: 16, marginTop: 4 }}>{world.story.centralConflict}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
