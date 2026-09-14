import { describe, expect, it } from "vitest";
import { DEFAULT_BINDS, checkBindable, isDown, isReservedCode, loadBinds, prettyCode } from "../../src/game/controls";
import type { GameAction } from "../../src/game/controls";

const key = (code: string, mods = {}) => ({ code, ctrlKey: false, metaKey: false, altKey: false, ...mods });

describe("controls", () => {
  it("ships defaults with no reserved keys", () => {
    for (const a of Object.keys(DEFAULT_BINDS) as GameAction[]) {
      expect(DEFAULT_BINDS[a].length).toBeGreaterThan(0);
      for (const c of DEFAULT_BINDS[a]) expect(isReservedCode(c)).toBe(false);
    }
  });

  it("rejects strict PC/browser keys and chords, accepts game keys", () => {
    for (const code of ["Tab", "Escape", "F5", "MetaLeft", "AltLeft", "Backspace"]) {
      expect(checkBindable(key(code)).ok).toBe(false);
    }
    expect(checkBindable(key("KeyW", { ctrlKey: true })).ok).toBe(false);
    expect(checkBindable(key("KeyW", { altKey: true })).ok).toBe(false);
    expect(checkBindable(key("KeyW")).ok).toBe(true);
    expect(checkBindable(key("Space")).ok).toBe(true);
  });

  it("labels keys readably", () => {
    expect(prettyCode("KeyW")).toBe("W");
    expect(prettyCode("Space")).toBe("Space");
    expect(prettyCode("ArrowUp")).toBe("↑");
    expect(prettyCode("ShiftLeft")).toBe("L-Shift");
  });

  it("matches held keys against binds", () => {
    const held = new Set(["KeyW", "Space"]);
    expect(isDown("forward", held, DEFAULT_BINDS)).toBe(true);
    expect(isDown("back", held, DEFAULT_BINDS)).toBe(false);
    expect(isDown("jump", held, DEFAULT_BINDS)).toBe(true);
  });

  it("falls back to defaults headless", () => {
    expect(loadBinds().forward).toEqual(DEFAULT_BINDS.forward);
  });
});
