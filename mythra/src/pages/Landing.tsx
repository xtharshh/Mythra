import { useState } from "react";
import { Link } from "react-router-dom";
import demo from "../data/demo-world.json";
import type { World } from "../types";
import { SupportButton } from "../components/Support";
import { Icon } from "../components/icons";
import type { IconName } from "../components/icons";
import { LandingTutorial, landingOnboardingSeen } from "../components/LandingTutorial";

const world = demo as unknown as World;

const LOGS: { kicker: string; icon: IconName; title: string; body: string; meta: string; img: string; alt: string }[] = [
  {
    kicker: "Field log 01",
    icon: "search",
    title: "Investigate the silence",
    body: "Walk Aurora Base, inspect the rover, play the helmet recording, fill the clue journal.",
    meta: "8+ clues · recorder · nav console",
    img: "/images/intro-investigate.svg",
    alt: "Rover, cracked helmet and clue journal under a Mars sky",
  },
  {
    kicker: "Field log 02",
    icon: "puzzle",
    title: "Earn the ridge code",
    body: "Solar sequence, hunter glyphs, hatch keypad. The note and the song disagree — trust both.",
    meta: "3 puzzles · hints on radio",
    img: "/images/intro-puzzle.svg",
    alt: "Ridge-code dial with solar glyphs beside a keypad and signal lights",
  },
  {
    kicker: "Field log 03",
    icon: "wrench",
    title: "Rebuild to survive",
    body: "Salvage metal and circuits, repair the habitat, restore the array, take the flight suit skyward.",
    meta: "scrap · drone · locker · chime",
    img: "/images/intro-survive.svg",
    alt: "Habitat dome repairs, solar array and supply rover at sunrise",
  },
];

const RUN_STEPS = ["Brief", "AI compiles world", "Descend to surface", "Inspect · collect · talk", "Solve puzzles", "Unlock hidden zones", "Truth + milestone card"];

export default function Landing() {
  const totalMinutes = world.missions.reduce((s, m) => s + m.estimatedMinutes, 0);
  // New / first-time explorers get the mouse-moving onboarding tour on open.
  const [tourOpen, setTourOpen] = useState(() => !landingOnboardingSeen());
  return (
    <div className="landing">
      {/* Image-based intro hero */}
      <section className="landing-hero">
        <img
          className="landing-hero-img"
          src="/images/hero-mars.svg"
          alt="Silent Mars colony at dusk — habitat domes, rover tracks and a huge red planet"
          fetchPriority="high"
        />
        <div className="landing-hero-shade" aria-hidden />
        <div className="landing-hero-inner">
          <div className="case-kicker">Mythio · image-based intro · Silent Mars Colony</div>
          <h1 className="case-title">The silent<br /><em>Mars colony.</em></h1>
          <p className="landing-lede">
            {world.story.premise} {world.story.background} You are {world.story.playerRole}
          </p>
          <div className="row" style={{ marginTop: 18 }}>
            <Link id="hero-play" className="btn btn-big" to="/play"><Icon name="play" size={15} /> Play</Link>
            <Link className="btn-ghost" to="/create">Make a story</Link>
            <Link className="btn-ghost" to="/explore">Browse stories</Link>
            <button className="btn-ghost" title="Replay the first-time tour (same mouse + keys practice)" onClick={() => setTourOpen(true)}>Take tour</button>
            <SupportButton />
          </div>
          <div className="dossier-meta" style={{ marginTop: 12 }}>
            {world.missions.length} missions · {world.clues.length} clues · {world.puzzles.length} puzzles · hidden lab · est. {totalMinutes} min
          </div>
        </div>
      </section>

      <div className="layout" style={{ paddingTop: 26 }}>
        <div className="grid">
          {LOGS.map((l) => (
            <article className="card landing-card" key={l.kicker}>
              <img className="landing-card-img" src={l.img} alt={l.alt} loading="lazy" />
              <div className="case-kicker" style={{ marginTop: 12 }}>{l.kicker}</div>
              <div className="row" style={{ gap: 8, marginTop: 4 }}>
                <span style={{ color: "var(--th-accent)", display: "inline-flex" }}><Icon name={l.icon} size={18} /></span>
                <b style={{ fontSize: 16 }}>{l.title}</b>
              </div>
              <div className="muted" style={{ marginTop: 6 }}>{l.body}</div>
              <div className="dossier-meta" style={{ marginTop: 8 }}>{l.meta}</div>
            </article>
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

        <div className="card" style={{ marginTop: 16 }}>
          <div className="case-kicker">How a run plays</div>
          <div className="landing-steps">
            {RUN_STEPS.map((s, i) => (
              <span key={s} className="landing-step">
                {i > 0 && <span className="landing-step-arrow" aria-hidden>→</span>}
                <span className="pill">{s}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 16 }}>
            <div style={{ flex: "1 1 260px" }}>
              <div className="case-kicker">Fuel the mission</div>
              <b style={{ fontSize: 17 }}>MYTHIO runs on coffee and curiosity.</b>
              <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                Every coffee keeps the suits charged — new genres, new props, new worlds.
                Made with obsession by <b>xtharshh</b>.
              </p>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <SupportButton />
              <a className="btn-ghost" href="https://instagram.com/xt.harshh" target="_blank" rel="noreferrer" title="xtharshh on Instagram">
                @xt.harshh
              </a>
            </div>
          </div>
        </div>
      </div>
      {tourOpen && <LandingTutorial onClose={() => setTourOpen(false)} />}
    </div>
  );
}
