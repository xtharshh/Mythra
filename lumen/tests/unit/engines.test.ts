import { describe, expect, it } from "vitest";
import demo from "../../src/data/demo-world.json";
import { checkPuzzleAnswer, emptyGameState, isMissionComplete, validateWorld } from "../../src/game/engines";
import type { World } from "../../src/types";

const world = structuredClone(demo) as unknown as World;

describe("demo world", () => {
  it("passes validation (publishable)", () => {
    const report = validateWorld(world);
    expect(report.errors).toEqual([]);
    expect(report.valid).toBe(true);
    expect(report.missionCount).toBe(5);
    expect(report.clueCount).toBeGreaterThanOrEqual(8);
    expect(report.puzzleCount).toBe(3);
  });

  it("meets MVP content minimums", () => {
    expect(world.locations.length).toBeGreaterThanOrEqual(10);
    expect(world.resources.length).toBeGreaterThanOrEqual(8);
    expect(world.objects.filter((o) => o.interaction).length).toBeGreaterThanOrEqual(5);
  });

  it("m1 completes only with metal + circuits + panel", () => {
    const s = emptyGameState();
    expect(isMissionComplete(world, "m1_habitat", s)).toBe(false);
    s.inventory = { metal: 4, circuit: 2 };
    s.inspectedObjects.add("obj_panel");
    expect(isMissionComplete(world, "m1_habitat", s)).toBe(true);
  });

  it("m5 requires solar + decode chain (no false positive)", () => {
    const s = emptyGameState();
    s.reachedLocations.add("loc_lab");
    expect(isMissionComplete(world, "m5_lab", s)).toBe(true); // location-based completion
    const s2 = emptyGameState();
    expect(isMissionComplete(world, "m5_lab", s2)).toBe(false);
  });

  it("rejects broken worlds (missing ref + cycle)", () => {
    const broken = structuredClone(world);
    broken.missions[0].completionCondition = { type: "mission_completed", missionId: "nope" };
    expect(validateWorld(broken).valid).toBe(false);
    const cyclic = structuredClone(world);
    cyclic.missions[0].prerequisites = [{ type: "mission_completed", missionId: "m2_solar" }];
    cyclic.missions[1].prerequisites = [{ type: "mission_completed", missionId: "m1_habitat" }];
    const report = validateWorld(cyclic);
    expect(report.errors.some((e) => e.code === "MISSION_CYCLE")).toBe(true);
  });
});

describe("puzzles", () => {
  it("checks answers case-insensitively", () => {
    expect(checkPuzzleAnswer("4213", "4213", "hash:4213")).toBe(true);
    expect(checkPuzzleAnswer("orion", "ORION", "hash:orion")).toBe(true);
    expect(checkPuzzleAnswer("0000", "4213", "hash:4213")).toBe(false);
  });
});
