import { describe, expect, it } from "vitest";
import { PROVIDERS, buildChapterPrompt, buildWorldPrompt, endpointFor, normalizeEnvironmentForTheme, normalizeThemeId, parseChapterDraft, repairWorldShape, retargetRoadTheme } from "../../src/ai/providers";
import type { WorldGenerationInput } from "../../src/types";

const input: WorldGenerationInput = {
  prompt: "haunted lighthouse",
  difficulty: "medium",
  missionCount: 5,
  clueDensity: "medium",
  puzzleIntensity: "medium",
  allowConstruction: false,
  allowPlayerContributions: true,
};

describe("universal AI providers", () => {
  it("registers every director with an endpoint or mock", () => {
    const ids = PROVIDERS.map((p) => p.id);
    for (const id of ["mock", "openai", "anthropic", "gemini", "openrouter", "groq", "mistral", "nim", "ollama", "custom"] as const) {
      expect(ids).toContain(id);
    }
    for (const p of PROVIDERS) {
      if (p.id === "mock" || p.id === "custom") continue; // custom brings its own model+endpoint
      expect(p.defaultModel.length).toBeGreaterThan(0);
    }
  });

  it("resolves endpoints (custom override wins)", () => {
    expect(endpointFor({ provider: "openai", apiKey: "", model: "x", keySource: "system" })).toContain("openai.com");
    expect(endpointFor({ provider: "custom", apiKey: "", model: "x", keySource: "system", baseUrl: "https://my.host/v1/" })).toBe("https://my.host/v1");
  });

  it("briefs the model with a JSON-only contract", () => {
    const { system, user } = buildWorldPrompt(input);
    expect(system).toMatch(/ONLY.*JSON/i);
    expect(system).toMatch(/locations/);
    expect(system).toMatch(/missions/);
    expect(user).toMatch(/haunted lighthouse/);
  });

  it("forgives theme paraphrases before the strict check", () => {
    expect(normalizeThemeId("ocean")).toBe("ocean");
    expect(normalizeThemeId("Underwater")).toBe("ocean");
    expect(normalizeThemeId("sci-fi")).toBe("space");
    expect(normalizeThemeId("medieval")).toBe("fantasy");
    expect(normalizeThemeId("Martian")).toBe("mars");
  });

  it("repairs small-model quirks: numeric ids, dropped flags, invented enums", () => {
    const raw = {
      missions: [{ id: 7, prerequisites: ["m1", { type: "all", conditions: [] }], rewards: [], objectives: [{ id: 1, type: "inspect_object", description: "Look", targetId: 9 }] }],
      clues: [{ importance: "HIGH" }],
      puzzles: [{ inputs: [{ id: "a", label: "A", kind: "number" }] }],
      locations: [{ position: [0, 0, 0] }],
      objects: [{ id: 3, type: "lighthouse", modelId: "made-up", locationId: "nope", interaction: { kind: "open" } }],
    };
    repairWorldShape(raw);
    const m = (raw.missions as Array<Record<string, unknown>>)[0];
    expect(m.id).toBe("7");
    expect(m.prerequisites).toEqual([{ type: "all", conditions: [] }]);
    expect(m.hidden).toBe(false);
    expect((m.objectives as Array<Record<string, unknown>>)[0].targetId).toBe("9");
    expect((raw.clues as Array<Record<string, unknown>>)[0].importance).toBe("critical");
    expect(((raw.puzzles as Array<Record<string, unknown>>)[0].inputs as Array<Record<string, unknown>>)[0].kind).toBe("text");
    expect((raw.locations as Array<Record<string, unknown>>)[0].locked).toBe(false);
    const o = (raw.objects as Array<Record<string, unknown>>)[0];
    expect(o.type).toBe("building");
    expect(o.modelId).toBeUndefined();
    expect((o.interaction as Record<string, unknown>).kind).toBe("inspect");
  });

  it("deep-repairs small-model conditions: aliases, renamed fields, nested junk", () => {
    const raw = {
      missions: [{
        // what gpt-oss on Groq/NIM actually ships: paraphrased types,
        // `item` for `itemId`, missing quantity, junk nested in `all`
        prerequisites: ["m1", { type: "mission_complete", mission: "m0" }],
        startCondition: { type: "all" },
        completionCondition: {
          type: "all",
          conditions: [
            { type: "collect_item", item: "fuel", count: "3" },
            { type: "item_owned", itemId: "metal" },
            "just a string",
            { type: "mission_completed" },
          ],
        },
        failureCondition: { nope: true },
      }],
      endings: [{ condition: { type: "visit", place: "loc_x" } }],
      locations: [{ unlockCondition: 42 }],
    };
    repairWorldShape(raw);
    const m = (raw.missions as Array<Record<string, unknown>>)[0];
    expect(m.prerequisites).toEqual([{ type: "mission_completed", missionId: "m0" }]);
    expect(m.startCondition).toEqual({ type: "all", conditions: [] });
    expect(m.completionCondition).toEqual({
      type: "all",
      conditions: [
        { type: "item_owned", itemId: "fuel", quantity: 3 },
        { type: "item_owned", itemId: "metal", quantity: 1 },
      ],
    });
    expect(m.failureCondition).toBeUndefined();
    expect((raw.endings as Array<Record<string, unknown>>)[0].condition)
      .toEqual({ type: "location_reached", locationId: "loc_x" });
    expect((raw.locations as Array<Record<string, unknown>>)[0].unlockCondition).toBeUndefined();
  });

  it("snaps near-aligned road slabs into one avenue, leaves grids alone", () => {
    const road = (x: number, z: number) => ({
      id: `r${x}x${z}`, type: "landmark", modelId: "road", name: "Road",
      description: "", locationId: "loc_landing", position: [x, 0, z] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number],
      visibility: "visible" as const,
    });
    const nearMiss = { objects: [road(0.4, -6), road(-0.3, 0), road(0.8, 6)] };
    repairWorldShape(nearMiss);
    expect((nearMiss.objects as Array<{ position: number[] }>).map((o) => o.position[0]))
      .toEqual([0.4, 0.4, 0.4]);
    const grid = { objects: [road(-8, 0), road(0, 0), road(8, 0)] };
    repairWorldShape(grid);
    expect((grid.objects as Array<{ position: number[] }>).map((o) => o.position[0]))
      .toEqual([-8, 0, 8]);
  });

  it("paints theme-true palettes and rescues highway tales from Mars", () => {    // road story misfiled as mars → neon cyberpunk streets, never red dust
    const road = {
      theme: "mars",
      name: "Highway Havoc",
      description: "A road safety tale",
      story: { premise: "Drive the city highway", background: "traffic", centralConflict: "signals" },
      environment: { type: "mars", skyColor: "#1a0b2e", fogColor: "#b5533c", primaryColor: "#c1553b", secondaryColor: "#ff6b35" },
    };
    retargetRoadTheme(road, "Brief: a road safety story with driving");
    normalizeEnvironmentForTheme(road);
    expect(road.theme).toBe("cyberpunk");
    expect(road.environment.type).toBe("cyberpunk");
    expect(road.environment.skyColor).toBe("#0b0620");
    expect(road.environment.primaryColor).toBe("#23262f");
    // a real Mars colony stays red
    const mars = {
      theme: "mars",
      name: "Silent Mars Colony",
      story: { premise: "Mars colony lost contact", background: "dust", centralConflict: "sol" },
      environment: { type: "mars", skyColor: "#1a0b2e", fogColor: "#b5533c", primaryColor: "#c1553b", secondaryColor: "#ff6b35" },
    };
    retargetRoadTheme(mars, "Brief: abandoned Mars colony");
    normalizeEnvironmentForTheme(mars);
    expect(mars.theme).toBe("mars");
    expect(mars.environment.primaryColor).toBe("#c1553b");
  });

  it("briefs chapter drafts with tale context + strict shape", () => {
    const { system, user } = buildChapterPrompt({
      taleName: "Silent colony", premise: "Everyone left.", background: "Dust.",
      recentChapters: [{ title: "Doors", text: "The hatch sighed open." }],
      kind: "story_fragment", idea: "the lights flicker twice",
    });
    expect(system).toMatch(/ONLY.*JSON/i);
    expect(user).toContain("the lights flicker twice");
    expect(user).toContain("Doors");
    const good = parseChapterDraft('```json\n{"title":"Flicker","text":"The rover headlights flickered twice against the dark ridge line."}\n```');
    expect(good.title).toContain("Flicker");
    expect(good.text).toContain("flickered twice");
    expect(() => parseChapterDraft("not json at all")).toThrow(/retry drafting/i);
    expect(() => parseChapterDraft(JSON.stringify({ title: "x", text: "too short" }))).toThrow(/too little/i);
  });
});
