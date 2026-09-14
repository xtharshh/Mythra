import { beforeEach, describe, expect, it } from "vitest";
import { DICTS, LANGS, getLang, setLang, t, tutorialSteps } from "../../src/i18n/lang";
import type { LangId } from "../../src/i18n/lang";

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

describe("i18n (every country reads the mission)", () => {
  it("every language ships every chrome key + all 7 reels", () => {
    const enKeys = Object.keys(DICTS.en.chrome).sort();
    expect(enKeys.length).toBeGreaterThan(20);
    for (const { id } of LANGS) {
      expect(Object.keys(DICTS[id].chrome).sort()).toEqual(enKeys);
      expect(DICTS[id].steps).toHaveLength(12);
      for (const s of DICTS[id].steps) {
        expect(s.title.length).toBeGreaterThan(0);
        expect(s.text.length).toBeGreaterThan(20);
      }
    }
  });

  it("falls back English → key, persists the pick", () => {
    expect(getLang()).toBe("en");
    setLang("hi");
    expect(getLang()).toBe("hi");
    expect(t("nav.archive", "hi")).toBe("अभिलेख");
    expect(t("nav.archive", "xx" as LangId)).toBe("Archive");
    expect(t("no.such.key", "hi")).toBe("no.such.key");
    expect(tutorialSteps("es")[0].title.length).toBeGreaterThan(0);
  });
});
