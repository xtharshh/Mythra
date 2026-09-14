import { describe, expect, it } from "vitest";
import demo from "../../src/data/demo-world.json";
import { exportWorldCode, importWorldCode } from "../../src/game/share";
import type { World } from "../../src/types";

const world = structuredClone(demo) as unknown as World;

describe("share codes", () => {
  it("round-trips a world", () => {
    const code = exportWorldCode(world);
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThan(100);
    const back = importWorldCode(code);
    expect(back.id).toBe(world.id);
    expect(back.missions.length).toBe(world.missions.length);
    expect(back.clues.length).toBe(world.clues.length);
  });

  it("rejects garbage with readable errors", () => {
    expect(() => importWorldCode("nope")).toThrow();
    expect(() => importWorldCode(exportWorldCode({ nope: 1 } as unknown as World))).toThrow();
  });
});
