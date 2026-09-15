import { describe, expect, it } from "vitest";
import { MockProvider, inferThemeFromPrompt } from "../../src/ai/mockProvider";
import type { WorldGenerationInput } from "../../src/types";

function input(overrides: Partial<WorldGenerationInput> = {}): WorldGenerationInput {
  return {
    prompt: "abandoned Mars colony",
    difficulty: "medium",
    missionCount: 5,
    clueDensity: "medium",
    puzzleIntensity: "medium",
    allowConstruction: false,
    allowPlayerContributions: true,
    ...overrides,
  };
}

describe("mock provider fills smartly from the brief", () => {
  it("infers theme from prompt keywords", () => {
    expect(inferThemeFromPrompt("neon city heist")).toBe("cyberpunk");
    expect(inferThemeFromPrompt("haunted lighthouse")).toBe("horror");
    expect(inferThemeFromPrompt("deep sea trench")).toBe("ocean");
    expect(inferThemeFromPrompt("abandoned Mars colony")).toBe("mars");
    expect(inferThemeFromPrompt("a tale of pies")).toBe("");
  });

  it("explicit theme beats prompt keywords", () => {
    expect(inferThemeFromPrompt("neon city heist", "desert")).toBe("desert");
  });

  it("paints the winning theme's palette and fills to match", async () => {
    const world = await new MockProvider().generateWorldPlan(input({ prompt: "neon city highway heist" }));
    expect(world.theme).toBe("cyberpunk");
    expect(world.environment.type).toBe("cyberpunk");
    expect(world.environment.skyColor).toBe("#0b0620");
    // cyber fill: towers, billboards, lamps — never Mars red props
    const models = world.objects.map((o) => o.modelId);
    expect(models).toContain("building");
    expect(world.objects.length).toBeGreaterThan(60);
  });

  it("keeps Mars tales red and populates colony clutter", async () => {
    const world = await new MockProvider().generateWorldPlan(input({ prompt: "abandoned Mars colony" }));
    expect(world.theme).toBe("mars");
    expect(world.environment.primaryColor).toBe("#c1553b");
    expect(world.objects.some((o) => o.modelId === "road")).toBe(true);
  });

  it("retargets road tales off Mars even without city words", async () => {
    const world = await new MockProvider().generateWorldPlan(input({ prompt: "a highway driving lesson with traffic signals" }));
    expect(world.theme).toBe("cyberpunk");
  });

  it("never doubles the baked demo base (idempotent over baked data)", async () => {
    const a = await new MockProvider().generateWorldPlan(input({}));
    // hand-placed story objects survive exactly once
    for (const id of ["obj_panel", "obj_rover", "obj_labdoor", "obj_datacore"]) {
      expect(a.objects.filter((o) => o.id === id)).toHaveLength(1);
    }
  });
});
