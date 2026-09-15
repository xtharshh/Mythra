import { describe, expect, it } from "vitest";
import { CHARACTERS, DEFAULT_AVATAR, decodeSuit, encodeSuit, hashUser, loadAvatar, loadCharacter, saveAvatar, suitForUser } from "../../src/game/suits";

describe("scenario suits", () => {
  it("is stable per explorer", () => {
    expect(suitForUser("ivan", "mars")).toEqual(suitForUser("IVAN", "mars"));
    expect(hashUser("a")).not.toBe(hashUser("b"));
  });

  it("dresses the theme (mars dust, ocean dive, fallback kit)", () => {
    expect(suitForUser("ivan", "mars").label).toBe("dust ops");
    expect(suitForUser("ivan", "ocean").label).toBe("dive rig");
    expect(suitForUser("ivan", "nope").label).toBe("field kit");
    expect(suitForUser("ivan", "mars").suit).not.toBe(suitForUser("ivan", "ocean").suit);
  });

  it("offers distinct pickable characters, defaulting headless", () => {
    expect(CHARACTERS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(CHARACTERS.map((c) => c.suit)).size).toBe(CHARACTERS.length);
    expect(loadCharacter().id).toBe(CHARACTERS[0].id);
  });

  it("round-trips picked suits over presence, falls back cleanly", () => {
    const code = encodeSuit(0xea580c, 0x22d3ee);
    expect(decodeSuit(code, "x", "mars")).toEqual({ suit: 0xea580c, accent: 0x22d3ee, body: "astronaut" });
    const fb = suitForUser("x", "mars");
    expect(decodeSuit("garbage", "x", "mars")).toEqual({ suit: fb.suit, accent: fb.accent, body: "astronaut" });
  });

  it("carries the chibi body over presence, reads legacy codes as astronaut", () => {
    const code = encodeSuit(0xea580c, 0x22d3ee, "chibi");
    expect(decodeSuit(code, "x", "mars")).toEqual({ suit: 0xea580c, accent: 0x22d3ee, body: "chibi" });
    expect(decodeSuit("ea580c:22d3ee", "x", "mars").body).toBe("astronaut");
  });

  it("loads a valid default avatar look headless, ignores bad saves", () => {
    expect(loadAvatar()).toEqual(DEFAULT_AVATAR);
    // headless: no localStorage → save is a safe no-op, load stays default
    saveAvatar({ ...DEFAULT_AVATAR, hairStyle: "spiky" });
    expect(loadAvatar()).toEqual(DEFAULT_AVATAR);
  });
});
