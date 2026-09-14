// Theme engine (skills.md §11): every page is theme-based (Mars dossier),
// never generic AI-SaaS. Tokens derive from world.environment so the site
// wears the same sky/fog/ground the 3D scene renders.
import type { World, WorldTheme } from "../types";

export interface ThemeTokens {
  key: WorldTheme | "default";
  station: string;
  tagline: string;
  sol: string;
  accent: string;
  accent2: string;
  danger: string;
  paper: string;
  ink: string;
  sky: string;
  fog: string;
  ground: string;
  heroGradient: string;
  planetGradient: string;
  ticker: string[];
}

const MARS: ThemeTokens = {
  key: "mars",
  station: "AURORA BASE",
  tagline: "Silent Mars Colony · case file 442",
  sol: "SOL 442",
  accent: "#ffb45e",
  accent2: "#ff6b35",
  danger: "#ff4444",
  paper: "#e9ddc2",
  ink: "#1a0f0a",
  sky: "#1a0b2e",
  fog: "#b5533c",
  ground: "#c1553b",
  heroGradient:
    "radial-gradient(900px 420px at 78% 8%, rgba(255,107,53,.35) 0%, transparent 60%), radial-gradient(1200px 800px at 70% -10%, #3b1428 0%, #160a1e 55%, #070714 100%)",
  planetGradient:
    "radial-gradient(circle at 32% 30%, #ffb08a 0%, #c1553b 38%, #7c2d1e 68%, #2b0f0a 100%)",
  ticker: ["O2 62%", "PWR RESTORING", "SOL 442", "RIDGE −24,−8", "6 CREW · 1 SIGNAL"],
};

const FALLBACKS: Record<string, ThemeTokens> = {
  ocean: {
    ...MARS, key: "ocean", station: "ABYSSAL RELAY", tagline: "Deep-signal station",
    sol: "DIVE 118", accent: "#67e8f9", accent2: "#0ea5e9", ground: "#0c4a6e", fog: "#155e75",
    sky: "#04121f",
    heroGradient: "radial-gradient(900px 420px at 78% 8%, rgba(103,232,249,.25) 0%, transparent 60%), radial-gradient(1200px 800px at 70% -10%, #0c2f45 0%, #04121f 60%, #02070d 100%)",
    planetGradient: "radial-gradient(circle at 32% 30%, #a5f3fc 0%, #0ea5e9 40%, #0c4a6e 70%, #02070d 100%)",
    ticker: ["O2 98%", "HULL NOMINAL", "DIVE 118", "SIGNAL DEEP"],
  },
  forest: {
    ...MARS, key: "forest", station: "CANOPY POST", tagline: "Green-signal expedition",
    sol: "DAY 87", accent: "#a3e635", accent2: "#16a34a", ground: "#3f6212", fog: "#4d7c0f",
    sky: "#0a1408",
    heroGradient: "radial-gradient(900px 420px at 78% 8%, rgba(163,230,53,.22) 0%, transparent 60%), radial-gradient(1200px 800px at 70% -10%, #1c2f12 0%, #0a1408 60%, #040704 100%)",
    planetGradient: "radial-gradient(circle at 32% 30%, #d9f99d 0%, #65a30d 40%, #1a2e05 75%, #040704 100%)",
    ticker: ["CANOPY 87%", "TRAILS OPEN", "DAY 87", "RIVER NORTH"],
  },
};

export function themeForWorld(world: World | null | undefined): ThemeTokens {
  const t = (world?.environment?.type ?? world?.theme ?? "mars") as string;
  if (t === "mars") return MARS;
  if (FALLBACKS[t]) return FALLBACKS[t];
  const env = world?.environment;
  if (!env) return MARS;
  return {
    ...MARS,
    key: "default",
    accent: "#ffb45e",
    accent2: env.secondaryColor ?? "#8b5cf6",
    sky: env.skyColor ?? MARS.sky,
    fog: env.fogColor ?? MARS.fog,
    ground: env.primaryColor ?? MARS.ground,
  };
}

/** Push theme vars onto <html> so index.css paints theme-first. */
export function applyTheme(tokens: ThemeTokens): void {
  try {
    const root = document.documentElement;
    root.dataset.theme = tokens.key;
    root.style.setProperty("--th-accent", tokens.accent);
    root.style.setProperty("--th-accent2", tokens.accent2);
    root.style.setProperty("--th-sky", tokens.sky);
    root.style.setProperty("--th-fog", tokens.fog);
    root.style.setProperty("--th-ground", tokens.ground);
    root.style.setProperty("--th-hero", tokens.heroGradient);
    root.style.setProperty("--th-planet", tokens.planetGradient);
  } catch {
    /* ignore headless */
  }
}
