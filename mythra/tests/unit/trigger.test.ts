import { describe, expect, it } from "vitest";
import { TRIGGER_POP_SEC, groundHeightAt, terrainAmp, triggerScale } from "../../src/three/effects";

describe("triggerScale", () => {
  it("rests at 1 outside the pop window", () => {
    expect(triggerScale(-0.1)).toBe(1);
    expect(triggerScale(TRIGGER_POP_SEC + 0.2)).toBe(1);
    expect(triggerScale(99)).toBe(1);
  });

  it("pops out and back exactly once", () => {
    expect(triggerScale(0)).toBeCloseTo(1, 6);
    const peak = triggerScale(TRIGGER_POP_SEC / 2);
    expect(peak).toBeGreaterThan(1.1);
    expect(triggerScale(TRIGGER_POP_SEC)).toBeCloseTo(1, 6);
  });
});

describe("groundHeightAt", () => {
  it("is deterministic and bounded", () => {
    expect(groundHeightAt(3, -7, "mars")).toBe(groundHeightAt(3, -7, "mars"));
    for (const [x, z] of [[0, 0], [10, -4], [-23, 31], [55, 55], [-55, -55]] as const) {
      const h = groundHeightAt(x, z, "mars");
      expect(Math.abs(h)).toBeLessThanOrEqual(2.0 * terrainAmp("mars") + 1e-9);
    }
  });

  it("keeps city avenues near-flat and wild dunes rolling", () => {
    expect(terrainAmp("cyberpunk")).toBeLessThan(terrainAmp("mars"));
    expect(Math.abs(groundHeightAt(10, 10, "cyberpunk"))).toBeLessThanOrEqual(0.61);
  });
});
