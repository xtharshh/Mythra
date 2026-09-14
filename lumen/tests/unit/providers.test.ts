import { describe, expect, it } from "vitest";
import { PROVIDERS, buildWorldPrompt, endpointFor } from "../../src/ai/providers";
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
    for (const id of ["mock", "openai", "anthropic", "gemini", "openrouter", "groq", "mistral", "ollama", "custom"] as const) {
      expect(ids).toContain(id);
    }
    for (const p of PROVIDERS) {
      if (p.id === "mock" || p.id === "custom") continue; // custom brings its own model+endpoint
      expect(p.defaultModel.length).toBeGreaterThan(0);
    }
  });

  it("resolves endpoints (custom override wins)", () => {
    expect(endpointFor({ provider: "openai", apiKey: "", model: "x" })).toContain("openai.com");
    expect(endpointFor({ provider: "custom", apiKey: "", model: "x", baseUrl: "https://my.host/v1/" })).toBe("https://my.host/v1");
  });

  it("briefs the model with a JSON-only contract", () => {
    const { system, user } = buildWorldPrompt(input);
    expect(system).toMatch(/ONLY.*JSON/i);
    expect(system).toMatch(/locations/);
    expect(system).toMatch(/missions/);
    expect(user).toMatch(/haunted lighthouse/);
  });
});
