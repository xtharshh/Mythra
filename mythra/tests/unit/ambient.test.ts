import { describe, expect, it } from "vitest";
import { AMBIENT_THEMES, ambientFor, loadAmbience, saveAmbience } from "../../src/audio/ambient";

describe("ambient universe sound", () => {
  it("scores every known theme with playable values", () => {
    for (const [name, t] of Object.entries(AMBIENT_THEMES)) {
      expect(t.root, name).toBeGreaterThan(20);
      expect(t.root, name).toBeLessThan(120);
      expect(t.shimmer.length, name).toBeGreaterThanOrEqual(4);
      expect(t.cutoff, name).toBeGreaterThan(100);
      expect(t.twinkleEvery[1], name).toBeGreaterThan(t.twinkleEvery[0]);
    }
  });

  it("mars hums low while forests breathe lighter", () => {
    expect(ambientFor("mars").root).toBeLessThan(ambientFor("forest").root);
    expect(ambientFor("ocean").wind).toBeGreaterThan(ambientFor("space").wind);
    expect(ambientFor("nope").label).toBe("dust drone");
  });

  it("defaults on headless without throwing", () => {
    expect(loadAmbience()).toBe(true);
    expect(() => saveAmbience(false)).not.toThrow();
  });
});
