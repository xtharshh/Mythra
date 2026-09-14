import { describe, expect, it } from "vitest";
import { RECIPES, setSfxOn, sfx, sfxOn } from "../../src/audio/sfx";

describe("sfx engine", () => {
  it("defines a valid recipe for every sound", () => {
    const names = ["click", "confirm", "error", "denied", "pickup", "clue", "mission", "checkpoint", "restore", "talk", "puzzle", "door", "fly", "land", "milestone"] as const;
    for (const n of names) {
      const tones = RECIPES[n];
      expect(tones.length, n).toBeGreaterThan(0);
      for (const t of tones) {
        expect(t.freq).toBeGreaterThan(0);
        expect(t.dur).toBeGreaterThan(0);
        expect(t.at).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("stays silent headless (no AudioContext) and honors the toggle", () => {
    expect(sfx("click")).toBe(false); // node has no AudioContext
    expect(() => setSfxOn(false)).not.toThrow();
    expect(() => setSfxOn(true)).not.toThrow();
  });
});
