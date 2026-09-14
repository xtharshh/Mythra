// Cinematic tutorial (first-run field manual): letterboxed mission briefing
// that teaches movement, look, interact, solve, fly, and keep — typewriter
// text, narration on demand, replayable anytime from the navbar Tutorial
// button. Auto-opens once per browser (mythra-tutorial-v1). Reels speak the
// explorer's language (src/i18n/lang.ts).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadVoiceSettings, speak, stopSpeaking } from "../audio/voice";
import { t, tutorialSteps, useLang } from "../i18n/lang";
import type { TutStep } from "../i18n/lang";

const TUTORIAL_KEY = "mythra-tutorial-v1";

/** True once the explorer has finished or skipped the reel. Headless = seen. */
export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === "1";
  } catch {
    return true;
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, "1");
  } catch {
    /* ignore */
  }
}

export interface TutorialStep {
  reel: string;
  title: string;
  text: string;
  controls: string;
}

/** English reels (test + fallback reference). UI uses tutorialSteps(lang). */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    reel: "Briefing · what this is",
    title: "You are the solver.",
    text: "Mythio forges any story into a walkable world. This colony went silent on Sol 442 — walk it, read it, fix it, and decide what Earth hears.",
    controls: "Watch · listen · then take the controls",
  },
  {
    reel: "Lesson 01 · move",
    title: "Boots on dust.",
    text: "WASD walks the surface. Hold Shift to sprint across the ridge, Space to jump the debris. Your explorer is always visible in third person.",
    controls: "WASD move · Shift sprint · Space jump",
  },
  {
    reel: "Lesson 02 · look",
    title: "Eyes up, solver.",
    text: "Drag the mouse to look around the colony. Press V to swap between third person and your own visor — first person sees what you see.",
    controls: "Drag look · V camera",
  },
  {
    reel: "Lesson 03 · touch",
    title: "Everything answers.",
    text: "Aim the reticle at anything glowing — rover, terminal, scrap, survivor — and press E (or click) to inspect, collect, talk, or repair it.",
    controls: "Aim + E interact · click works too",
  },
  {
    reel: "Lesson 04 · solve",
    title: "Follow the evidence.",
    text: "Missions track in the side panel, clues file into your journal, and locked hatches open on puzzle answers. Stuck? Every puzzle carries hints on the radio.",
    controls: "Missions · Journal · Hints",
  },
  {
    reel: "Lesson 05 · fly",
    title: "Earn the sky.",
    text: "Salvage what the colony left behind. Find the flight-suit locker and the sky opens: F toggles thrusters, Space climbs, C dives.",
    controls: "F fly · Space up · C down",
  },
  {
    reel: "Lesson 06 · keep",
    title: "Never lose a run.",
    text: "Saves and named checkpoints file under your login — per explorer, always. Open a race room to solve against friends, live, in scenario suits.",
    controls: "Menu → Save · Checkpoints · Invite solvers",
  },
];

function useTypewriter(text: string, speed = 14): string {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    try {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        setN(text.length);
        return;
      }
    } catch {
      /* headless */
    }
    const id = window.setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          window.clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed]);
  return text.slice(0, n);
}

export function Tutorial({ onClose }: { onClose: () => void }) {
  const { lang } = useLang();
  const steps: TutStep[] = tutorialSteps(lang);
  const [i, setI] = useState(0);
  const step = steps[Math.min(i, steps.length - 1)];
  const typed = useTypewriter(step.text);
  const last = i >= steps.length - 1;
  useEffect(() => () => stopSpeaking(), []);

  const finish = () => {
    markTutorialSeen();
    stopSpeaking();
    onClose();
  };
  const narrate = () => {
    try {
      const s = loadVoiceSettings();
      speak(`${step.title}. ${step.text}`, { ...s, enabled: true });
    } catch {
      /* voice unavailable */
    }
  };

  return (
    <div className="veil" role="dialog" aria-label="Mythio tutorial">
      <div className="cine-bar top" />
      <div className="intro-card card cine-frame">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="pill cyan">◉ {t("t.reel", lang)} · reel {i + 1}/{steps.length}</span>
          <button className="btn-ghost" style={{ padding: "4px 10px" }} onClick={finish}>{t("t.skip", lang)}</button>
        </div>
        <div className="case-kicker" style={{ marginTop: 8 }}>{step.reel}</div>
        <h1 className="intro-title" style={{ fontSize: 30 }}>{step.title}</h1>
        <p className="intro-text">{typed}<span className="caret" /></p>
        <div className="muted intro-controls">{step.controls}</div>
        <div className="cine-pips" aria-hidden>
          {steps.map((s, k) => (
            <i key={s.reel} className={k <= i ? "on" : undefined} />
          ))}
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          {i > 0 && (
            <button className="btn-ghost" onClick={() => setI((v) => v - 1)}>{t("t.back", lang)}</button>
          )}
          {!last && (
            <button className="btn" onClick={() => setI((v) => v + 1)}>{t("t.next", lang)}</button>
          )}
          {last && (
            <Link className="btn btn-big" to="/play" onClick={finish}>{t("t.begin", lang)}</Link>
          )}
          <button className="btn-ghost" title="Narrate this reel aloud" onClick={narrate}>{t("t.narrate", lang)}</button>
        </div>
        <div className="dossier-meta" style={{ marginTop: 8 }}>{t("t.replay", lang)}</div>
      </div>
      <div className="cine-bar bottom" />
    </div>
  );
}
