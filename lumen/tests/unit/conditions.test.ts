import { describe, expect, it } from "vitest";
import { evaluateCondition } from "../../src/game/conditions";
import type { GameState } from "../../src/types";
import { emptyGameState } from "../../src/game/engines";

function stateWith(patch: Partial<{ inventory: Record<string, number>; completed: string[]; clues: string[]; puzzles: string[]; objects: string[]; locations: string[]; flags: Record<string, string | number | boolean> }>): GameState {
  const s = emptyGameState();
  if (patch.inventory) s.inventory = patch.inventory;
  if (patch.completed) s.completedMissions = new Set(patch.completed);
  if (patch.clues) s.discoveredClues = new Set(patch.clues);
  if (patch.puzzles) s.solvedPuzzles = new Set(patch.puzzles);
  if (patch.objects) s.inspectedObjects = new Set(patch.objects);
  if (patch.locations) s.reachedLocations = new Set(patch.locations);
  if (patch.flags) s.flags = patch.flags;
  return s;
}

describe("evaluateCondition", () => {
  it("handles leaf conditions", () => {
    const s = stateWith({ inventory: { metal: 4 }, completed: ["m1"], clues: ["c1"], puzzles: ["p1"], objects: ["o1"], locations: ["l1"], flags: { f: true } });
    expect(evaluateCondition({ type: "mission_completed", missionId: "m1" }, s)).toBe(true);
    expect(evaluateCondition({ type: "mission_completed", missionId: "m2" }, s)).toBe(false);
    expect(evaluateCondition({ type: "item_owned", itemId: "metal", quantity: 4 }, s)).toBe(true);
    expect(evaluateCondition({ type: "item_owned", itemId: "metal", quantity: 5 }, s)).toBe(false);
    expect(evaluateCondition({ type: "clue_discovered", clueId: "c1" }, s)).toBe(true);
    expect(evaluateCondition({ type: "puzzle_solved", puzzleId: "p1" }, s)).toBe(true);
    expect(evaluateCondition({ type: "object_inspected", objectId: "o1" }, s)).toBe(true);
    expect(evaluateCondition({ type: "location_reached", locationId: "l1" }, s)).toBe(true);
    expect(evaluateCondition({ type: "flag_equals", key: "f", value: true }, s)).toBe(true);
  });

  it("handles all/any/not combinators", () => {
    const s = stateWith({ completed: ["m1"] });
    expect(evaluateCondition({ type: "all", conditions: [{ type: "mission_completed", missionId: "m1" }] }, s)).toBe(true);
    expect(evaluateCondition({ type: "all", conditions: [] }, s)).toBe(true); // start-condition TRUE
    expect(evaluateCondition({ type: "any", conditions: [{ type: "mission_completed", missionId: "mX" }, { type: "mission_completed", missionId: "m1" }] }, s)).toBe(true);
    expect(evaluateCondition({ type: "not", condition: { type: "mission_completed", missionId: "m1" } }, s)).toBe(false);
  });
});
