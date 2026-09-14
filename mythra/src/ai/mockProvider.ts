// Mock AI provider — deterministic, no API key needed (§12.5). Returns Mars demo variant.
import demoWorld from "../data/demo-world.json";
import type { AIProvider, World, WorldGenerationInput } from "../types";

export class MockProvider implements AIProvider {
  async generateWorldPlan(input: WorldGenerationInput): Promise<World> {
    await new Promise((r) => setTimeout(r, 600)); // simulate generation progress
    const base = structuredClone(demoWorld) as unknown as World;
    const prompt = input.prompt.trim();
    const suffix = prompt ? prompt.slice(0, 48) : "Untitled expedition";
    return {
      ...base,
      id: `world-${Date.now()}`,
      name: suffix.length > 3 ? `Expedition: ${suffix}` : base.name,
      slug: `expedition-${Date.now()}`,
      difficulty: input.difficulty,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
