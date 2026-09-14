import { describe, expect, it } from "vitest";
import { validateWorld } from "../../src/game/engines";
import demo from "../../src/data/demo-world.json";
import type { World } from "../../src/types";

const world = structuredClone(demo) as unknown as World;

describe("flight suit (sky roaming)", () => {
  it("world stays valid with suit + sky content", () => {
    const report = validateWorld(world);
    expect(report.errors).toEqual([]);
    expect(report.valid).toBe(true);
  });

  it("suit is obtainable in the story", () => {
    const locker = world.objects.find((o) => o.interaction?.givesItemId === "suit");
    expect(locker).toBeDefined();
    expect(world.resources.some((r) => r.id === "suit")).toBe(true);
  });

  it("sky chime clue resolves to a real floating object", () => {
    const clue = world.clues.find((c) => c.id === "clue_skysong");
    expect(clue).toBeDefined();
    const obj = world.objects.find((o) => o.id === clue?.objectId);
    expect(obj).toBeDefined();
    expect(obj?.position[1]).toBeGreaterThan(10); // only reachable by flight
    const meta = obj?.metadata as { spin?: boolean; float?: boolean } | undefined;
    expect(meta?.spin).toBe(true);
    expect(world.locations.some((l) => l.id === clue?.locationId)).toBe(true);
  });

  it("garage mission nudges toward the suit (optional)", () => {
    const m3 = world.missions.find((m) => m.id === "m3_rover");
    const opt = m3?.objectives.find((o) => o.targetId === "suit");
    expect(opt?.optional).toBe(true);
  });
});
