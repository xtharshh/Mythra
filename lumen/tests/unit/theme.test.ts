import { describe, expect, it } from "vitest";
import demo from "../../src/data/demo-world.json";
import { themeForWorld } from "../../src/theme/theme";
import type { World } from "../../src/types";

const world = demo as unknown as World;

describe("theme engine (theme-first site)", () => {
  it("derives Mars tokens from the demo environment", () => {
    const t = themeForWorld(world);
    expect(t.key).toBe("mars");
    expect(t.station).toMatch(/AURORA/);
    expect(t.sky).toBe(world.environment.skyColor);
    expect(t.ground).toBe(world.environment.primaryColor);
    expect(t.ticker.length).toBeGreaterThan(0);
  });

  it("falls back to Mars dossier without a world", () => {
    const t = themeForWorld(null);
    expect(t.key).toBe("mars");
    expect(t.sol).toMatch(/SOL/);
  });
});
