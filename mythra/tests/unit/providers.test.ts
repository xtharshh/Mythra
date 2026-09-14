import { describe, expect, it } from "vitest";
import { PROVIDERS, buildChapterPrompt, buildWorldPrompt, endpointFor, normalizeThemeId, parseChapterDraft, repairWorldShape } from "../../src/ai/providers";
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
