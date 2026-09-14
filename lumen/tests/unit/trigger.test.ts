import { describe, expect, it } from "vitest";
import { TRIGGER_POP_SEC, triggerScale } from "../../src/three/effects";

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
