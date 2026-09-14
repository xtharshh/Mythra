import { beforeEach, describe, expect, it } from "vitest";
import { TUTORIAL_STEPS, markTutorialSeen, tutorialSeen } from "../../src/components/Tutorial";

// node test env has no DOM storage — minimal in-memory stand-in
const mem = new Map<string, string>();

beforeEach(() => {
  mem.clear();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => {
        mem.set(k, String(v));
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    },
    configurable: true,
    writable: true,
  });
});

describe("cinematic tutorial", () => {
  it("plays once per browser (until finished or skipped)", () => {
    expect(tutorialSeen()).toBe(false);
    markTutorialSeen();
    expect(tutorialSeen()).toBe(true);
  });

  it("covers the full field manual — move, look, interact, solve, fly, keep", () => {
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(6);
    const titles = TUTORIAL_STEPS.map((s) => s.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const s of TUTORIAL_STEPS) {
      expect(s.reel.length).toBeGreaterThan(0);
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.text.length).toBeGreaterThan(20);
      expect(s.controls.length).toBeGreaterThan(0);
    }
    const all = TUTORIAL_STEPS.map((s) => `${s.title} ${s.text} ${s.controls}`.toLowerCase()).join(" ");
    for (const word of ["wasd", "interact", "mission", "puzzle", "fly", "checkpoint"]) {
      expect(all).toContain(word);
    }
  });
});
