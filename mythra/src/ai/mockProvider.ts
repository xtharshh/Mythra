// Mock AI provider — deterministic, no API key needed (§12.5). Returns Mars demo variant.
import demoWorld from "../data/demo-world.json";
import type { AIProvider, World, WorldGenerationInput } from "../types";

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
    return {
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
  }
}
