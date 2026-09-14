import { describe, expect, it } from "vitest";
import { locationState, project } from "../../src/game/map";

describe("location map math", () => {
  it("centers the world middle", () => {
    const p = project(0, 0, 60, 264);
    expect(p.x).toBeCloseTo(132, 0);
    expect(p.y).toBeCloseTo(132, 0);
  });

  it("clamps far corners inside the canvas", () => {
    const p = project(9999, -9999, 60, 264);
    expect(p.x).toBeLessThanOrEqual(262);
    expect(p.y).toBeGreaterThanOrEqual(2);
  });

  it("states rings correctly", () => {
    expect(locationState(true, true)).toBe("reached");
    expect(locationState(true, false)).toBe("locked");
    expect(locationState(false, false)).toBe("open");
  });
});
