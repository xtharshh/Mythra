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

  it("lets the story's own branding win (station changes per tale)", () => {
    const custom = structuredClone(world);
    custom.branding = { station: "LIGHTHOUSE POST", sol: "NIGHT 003", tagline: "Haunted coast · case file 7" };
    const t = themeForWorld(custom);
    expect(t.station).toBe("LIGHTHOUSE POST");
    expect(t.sol).toBe("NIGHT 003");
    expect(t.tagline).toMatch(/case file 7/);
    // same Mars dust, new name
    expect(t.ground).toBe(themeForWorld(world).ground);
  });
});
