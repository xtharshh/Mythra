// Guided first-run tour for the home page (Landing).
// An animated mouse pointer glides from area to area (nav sections, hero
// Play button, practice pad) while a docked popup explains what each does
// and shows that page's screenshot.
//
// Shown once per browser (mythra-landing-onboarding-v1) for new /
// first-time explorers. Re-open anytime from the nav "Tutorial" button or
// the Landing hero "Take tour" button — same tour either way.
//
// Screenshots: drop the real captures at public/images/tour/<id>.png
// (dossier, archive, surface, planner, control). Until then each popup
// falls back to the stylised SVG mockup at public/images/tour/<id>.svg.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
import { Link } from "react-router-dom";
import { markTutorialSeen } from "./Tutorial";

const LANDING_ONBOARDING_KEY = "mythra-landing-onboarding-v1";

export function landingOnboardingSeen(): boolean {
  try {
    return localStorage.getItem(LANDING_ONBOARDING_KEY) === "1";
  } catch {
    return true;
  }
}

export function markLandingOnboardingSeen(): void {
  try {
    localStorage.setItem(LANDING_ONBOARDING_KEY, "1");
  } catch {
    /* ignore */
  }
}

/* ---------- per-step screenshot (real PNG, SVG mockup fallback) ---------- */

function TourShot({ id, alt }: { id: string; alt: string }) {
  const [fallback, setFallback] = useState(false);
  return (
    <img
      className="tour-shot"
      src={fallback ? `/images/tour/${id}.svg` : `/images/tour/${id}.png`}
      onError={() => setFallback(true)}
      alt={alt}
      loading="lazy"
    />
  );
}

/* ---------- interactive steps (kept from the first onboarding) ---------- */

function MousePractice() {
  const areaRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [touched, setTouched] = useState(false);

  const onMove = useCallback((e: ReactMouseEvent | ReactTouchEvent) => {
    const el = areaRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let cx: number, cy: number;
    if ("touches" in e) {
      const t = e.touches[0] ?? e.changedTouches[0];
      if (!t) return;
      cx = t.clientX; cy = t.clientY;
    } else {
      cx = e.clientX; cy = e.clientY;
    }
    const x = Math.min(Math.max((cx - r.left) / r.width, 0), 1);
    const y = Math.min(Math.max((cy - r.top) / r.height, 0), 1);
    setPos({ x, y });
    setTouched(true);
  }, []);

  return (
    <div
      ref={areaRef}
      id="tour-practice-pad"
      className="onboard-pad"
      role="application"
      aria-label="Mouse practice area — move your mouse or finger inside to steer the explorer"
      tabIndex={0}
      onMouseMove={onMove}
      onTouchMove={onMove}
      onTouchStart={onMove}
    >
      <div className="onboard-grid" aria-hidden />
      {pos ? (
        <div
          className="onboard-explorer"
          aria-hidden
          style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
        >
          <span className="onboard-explorer-dot" />
          <span className="onboard-explorer-ring" />
        </div>
      ) : (
        <div className="onboard-hint" aria-hidden>Move your mouse here →</div>
      )}
      <div className="onboard-pad-label">
        {touched ? "Nice — on the Surface you drag to look, WASD to walk." : "Move your mouse (or finger) inside this area"}
      </div>
    </div>
  );
}

function KeyPractice() {
  const [hit, setHit] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "e", " "].includes(k)) {
        setHit((prev) => new Set(prev).add(k === " " ? "space" : k));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const Key = ({ id, label }: { id: string; label: string }) => (
    <span className={`key${hit.has(id) ? " key-hit" : ""}`}>{label}</span>
  );

  return (
    <div id="tour-keys">
      <div className="row" style={{ gap: 8, marginTop: 4 }}>
        <Key id="w" label="W" /> <Key id="a" label="A" /> <Key id="s" label="S" /> <Key id="d" label="D" />
        <span className="muted" style={{ fontSize: 13 }}>move</span>
        <Key id="e" label="E" />
        <span className="muted" style={{ fontSize: 13 }}>interact</span>
        <Key id="space" label="Space" />
        <span className="muted" style={{ fontSize: 13 }}>jump</span>
      </div>
      <div className="dossier-meta" style={{ marginTop: 8 }}>
        {hit.size > 0 ? `Keys tried: ${hit.size}/6 — every key also remaps in the Control deck.` : "Press W A S D on your keyboard now — watch the keys light up."}
      </div>
    </div>
  );
}

/* ---------- tour script ---------- */

interface TourStep {
  id: string;
  target?: string; // CSS selector the pointer glides to
  title: string;
  kicker: string;
  body: string;
  shotAlt?: string; // screenshot shown in the popup
  interactive?: "mouse" | "keys";
  cta?: "play";
}

const STEPS: TourStep[] = [
  {
    id: "welcome",
    kicker: "New explorer briefing",
    title: "Welcome to Mythio.",
    body: "Watch the pointer — it glides to each area of the station and explains what it does. Type a story brief, walk it as a living world. No account needed to play.",
  },
  {
    id: "dossier",
    target: "#nav-dossier",
    kicker: "Stop 1 · Home",
    title: "Every tale starts here.",
    body: "Home is the mission cover: premise, field logs, central conflict, and how a run plays. This is where first-time explorers land.",
    shotAlt: "Screenshot of the Home page — Silent Mars Colony hero",
  },
  {
    id: "archive",
    target: "#nav-archive",
    kicker: "Stop 2 · Stories",
    title: "Find a mystery.",
    body: "Shared stories land in Stories with play counts and ratings. Search tales, filter by hazard, carry tales between sites with share codes, Enter to play or Fork to remix.",
    shotAlt: "Screenshot of the Stories page — story list with search and import",
  },
  {
    id: "surface",
    target: "#nav-surface",
    kicker: "Stop 3 · Play",
    title: "Descend and solve.",
    body: "Play drops you into the 3D world: walk with WASD, drag to look, E to interact, Space to jump, F to fly with the suit. Missions, map, journal and board ride along on the right.",
    shotAlt: "Screenshot of the Play page — 3D explorer with missions panel",
  },
  {
    id: "planner",
    target: "#nav-planner",
    kicker: "Stop 4 · Create",
    title: "File a new expedition.",
    body: "Describe any story — the AI director compiles it into a validated playable world. Bring any AI key, or stamp it keyless with Mock. Every tale is checked before filing.",
    shotAlt: "Screenshot of the Create page — expedition brief form",
  },
  {
    id: "control",
    target: "#nav-control",
    kicker: "Stop 5 · Studio",
    title: "Direct the mission.",
    body: "The Studio edits missions, clues, story, versions, validation and test mode. Tune ops orders, approve community chapters, roll back when a draft goes sideways.",
    shotAlt: "Screenshot of the Studio page — mission ops orders",
  },
  {
    id: "invite",
    kicker: "Stop 6 · Invite friends",
    title: "Solve it together.",
    body: "From Play, open Menu → Invite solvers: a short race link carries the whole tale. Friends join your live game with their own suits — explore side by side and race to solve the puzzles first.",
    shotAlt: "Screenshot of an invite link and live race room with fellow solvers",
  },
  {
    id: "voice",
    kicker: "Stop 7 · Voice notes & milestones",
    title: "Leave your voice in the world.",
    body: "Record voice notes on objects and clues so anyone can listen to your take on that clue. Finish a tale 100% to mint a shareable milestone card for X, WhatsApp and Telegram.",
    shotAlt: "Screenshot of voice notes on a clue and a milestone brag card",
  },
  {
    id: "board",
    kicker: "Stop 8 · Leaderboard",
    title: "Top the board.",
    body: "Every tale has a leaderboard: your best missions-plus-clues score, live solvers in the story right now, and speed boards for race rooms. Bragging rights included.",
    shotAlt: "Screenshot of the leaderboard with top solvers and live explorers",
  },
  {
    id: "play",
    target: "#hero-play",
    kicker: "Step 9 · your turn",
    title: "Press Play.",
    body: "The green Play button drops you onto the Surface of the Silent Mars Colony — 5 missions, 9 clues, 3 puzzles, about 50 minutes.",
    cta: "play",
  },
  {
    id: "mouse",
    target: "#tour-practice-pad",
    interactive: "mouse",
    kicker: "Step 10 · steer with your mouse",
    title: "Move the explorer.",
    body: "Try it right here inside the tour: the explorer follows your cursor. In Play you drag to look around and walk with WASD.",
  },
  {
    id: "keys",
    target: "#tour-keys",
    interactive: "keys",
    kicker: "Step 11 · walk, interact, jump",
    title: "Try the keys.",
    body: "Press W A S D now and watch the keys light up. E interacts with glowing objects, Space jumps, Shift sprints — all remappable in the Control deck.",
  },
];

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/* ---------- guided tour ---------- */

export function LandingTutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [arrived, setArrived] = useState(false);
  const step = STEPS[Math.min(i, STEPS.length - 1)];
  const last = i >= STEPS.length - 1;

  const finish = useCallback(() => {
    markLandingOnboardingSeen();
    // The tour covers the basics — don't re-prompt the cinematic reels after it.
    try { markTutorialSeen(); } catch { /* ignore */ }
    onClose();
  }, [onClose]);

  // Glide the pointer to the step target; re-measure after smooth scrolls.
  useLayoutEffect(() => {
    setArrived(false);
    setRect(null);
    if (!step.target) return;
    let alive = true;
    let timer = 0;
    const measure = () => {
      if (!alive || !step.target) return;
      const el = document.querySelector(step.target);
      if (!el) return; // target not on this page — popup stays docked, no pointer
      try {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch { /* ignore */ }
      const r = el.getBoundingClientRect();
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
      // arrival pulse once the glide (~1s) lands
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { if (alive) setArrived(true); }, 1150);
    };
    measure();
    const t = window.setTimeout(measure, 650); // second pass after smooth scroll
    window.addEventListener("resize", measure);
    return () => {
      alive = false;
      window.clearTimeout(t);
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, [step.target, i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setI((v) => Math.min(v + 1, STEPS.length - 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(v - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  const pointer = rect
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    : null;
  const missing = !!step.target && !rect;

  return (
    <div className="tour-root" role="dialog" aria-label="Guided tour — follow the pointer">
      {/* dim + spotlight cutout over the live target */}
      {rect && (
        <div
          className="tour-spot"
          aria-hidden
          style={{
            left: rect.left - 8,
            top: rect.top - 8,
            width: rect.width + 16,
            height: rect.height + 16,
          }}
        />
      )}
      {rect && <div className="tour-dim" aria-hidden />}

      {/* gliding pointer */}
      {pointer && (
        <div
          className="tour-cursor"
          aria-hidden
          style={{ left: pointer.x, top: pointer.y }}
        >
          <svg width="34" height="34" viewBox="0 0 24 24">
            <path
              d="M5 3l14 7.5-6.2 1.8L9.5 19 5 3z"
              fill="#ffb45e"
              stroke="#2b1006"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <circle cx="5.5" cy="3.5" r="2.2" fill="#ffd9a8" />
          </svg>
          <span className={`tour-ping${arrived ? " on" : ""}`} />
          {arrived && <span className="tour-click">click</span>}
        </div>
      )}

      {/* docked explainer popup with screenshot */}
      <div className="tour-sheet card">
        <div className="tour-sheet-main">
          {step.shotAlt && (
            <TourShot id={step.id} alt={step.shotAlt} />
          )}
          <div className="tour-sheet-text">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="pill cyan">◉ {i + 1}/{STEPS.length} · guided tour</span>
              <button className="btn-ghost" style={{ padding: "4px 10px" }} onClick={finish}>Skip tour</button>
            </div>
            <div className="case-kicker" style={{ marginTop: 8 }}>{step.kicker}</div>
            <h2 className="tour-title">{step.title}</h2>
            <p className="muted" style={{ margin: "6px 0 0" }}>{step.body}</p>
            {missing && (
              <p className="dossier-meta" style={{ marginTop: 6 }}>
                (That area lives on another page — open this tour from the home page to see the pointer land on it.)
              </p>
            )}
            {step.interactive === "mouse" && <MousePractice />}
            {step.interactive === "keys" && <KeyPractice />}
            {step.cta === "play" && (
              <div className="row" style={{ marginTop: 10 }}>
                <Link id="tour-play-cta" className="btn" to="/play" onClick={finish}>▶ Play now</Link>
              </div>
            )}
            <div className="cine-pips" aria-hidden>
              {STEPS.map((s, k) => (
                <i key={s.id} className={k <= i ? "on" : undefined} />
              ))}
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              {i > 0 && (
                <button className="btn-ghost" onClick={() => setI((v) => v - 1)}>← Back</button>
              )}
              {!last && (
                <button className="btn" onClick={() => setI((v) => v + 1)}>Next →</button>
              )}
              {last && (
                <Link className="btn btn-big" to="/play" onClick={finish}>Begin expedition</Link>
              )}
              <button className="btn-ghost" onClick={finish} title="Close the tour (Esc)">Later</button>
            </div>
            <div className="dossier-meta" style={{ marginTop: 8 }}>Shows once for new explorers · replay anytime with “Tutorial” or “Take tour” · ← → keys work too</div>
          </div>
        </div>
      </div>
    </div>
  );
}
