// Mock AI provider — deterministic, no API key needed (§12.5). Returns Mars demo variant.
// The fill is prompt-smart: the theme comes from the brief (explicit theme
// first, then prompt keywords, then road-tale retarget), the palette follows
// the theme, and the scatter density follows the brief's clue density.
import demoWorld from "../data/demo-world.json";
import type { AIProvider, World, WorldGenerationInput, WorldTheme } from "../types";
import { populateWorld } from "../three/worldPopulator";
import { hashStr } from "../three/factory";
import { briefIsRoadTale, normalizeEnvironmentForTheme, normalizeThemeId, retargetRoadTheme } from "./providers";

const KNOWN_THEMES: WorldTheme[] = [
  "mars", "space", "ocean", "forest", "fantasy", "cyberpunk",
  "ancient_ruins", "desert", "horror", "post_apocalyptic", "custom",
];

/** Best theme guess for a free-text brief: explicit pick wins, otherwise the
 *  first prompt word that maps onto a known theme (city→cyberpunk,
 *  haunted→horror, …). Empty string = no signal, keep the base theme. */
export function inferThemeFromPrompt(prompt: string, explicit?: WorldTheme): WorldTheme | "" {
  if (explicit) {
    const t = normalizeThemeId(explicit);
    if ((KNOWN_THEMES as string[]).includes(t)) return t as WorldTheme;
  }
  const words = prompt.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  for (const w of words) {
    const t = normalizeThemeId(w);
    if ((KNOWN_THEMES as string[]).includes(t) && t !== "custom") return t as WorldTheme;
  }
  return "";
}

export class MockProvider implements AIProvider {
  async generateWorldPlan(input: WorldGenerationInput): Promise<World> {
    await new Promise((r) => setTimeout(r, 600)); // simulate generation progress
    const base = structuredClone(demoWorld) as unknown as World;
    const prompt = input.prompt.trim();
    const suffix = prompt ? prompt.slice(0, 48) : "Untitled expedition";
    const marsy = /mars|aurora|colony|sol\s*\d+/i.test(prompt);
    // station ident follows the brief — only Mars tales keep AURORA BASE
    const words = prompt.replace(/[^a-z0-9\s]/gi, "").split(/\s+/).filter((w) => w.length > 2 && !/^(the|and|where|with|from|that|players?|create)$/i.test(w));
    const station = marsy ? "AURORA BASE" : (words.slice(0, 2).join(" ").toUpperCase().slice(0, 18) || "FIELD BASE");
    const world = {
      ...base,
      id: `world-${Date.now()}`,
      name: suffix.length > 3 ? `Expedition: ${suffix}` : base.name,
      slug: `expedition-${Date.now()}`,
      difficulty: input.difficulty,
      branding: {
        station,
        sol: marsy ? "SOL 442" : "SOL 001",
        tagline: marsy ? "Silent Mars Colony · case file 442" : `${input.difficulty} expedition · case file ${String(Date.now()).slice(-4)}`,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Theme follows the brief: explicit pick → prompt keywords → road-tale
    // retarget (highway tales leave red dust for neon streets). The palette
    // pass keeps sky/fog/ground in sync with whatever theme wins.
    const inferred = inferThemeFromPrompt(prompt, input.theme);
    if (inferred) world.theme = inferred;
    // The baked base story is always Mars-flavored, so it would veto the
    // road retarget — judge the brief on its own words instead.
    if (!inferred && briefIsRoadTale(prompt)) world.theme = "cyberpunk";
    retargetRoadTheme(world, prompt);
    normalizeEnvironmentForTheme(world);
    // Fresh scatter per generation so two briefs never share one layout.
    // populateWorld strips any previous bake first, so the baked demo base
    // never doubles up when this runs on top of it.
    const seed = (hashStr(`${prompt}|${Date.now()}`)) >>> 0;
    world.environment.terrainSeed = seed;
    populateWorld(world, {
      theme: world.theme,
      seed,
      worldBounds: world.settings.worldBounds,
      density: input.clueDensity,
    });
    return world;
  }
}
