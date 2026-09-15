// Pure recursive condition evaluator — §11. No arbitrary JS allowed.
import type { Condition, GameState } from "../types.js";

export function evaluateCondition(condition: Condition, state: GameState): boolean {
  switch (condition.type) {
    case "mission_completed": return state.completedMissions.has(condition.missionId);
    case "clue_discovered": return state.discoveredClues.has(condition.clueId);
    case "item_owned": return (state.inventory[condition.itemId] ?? 0) >= condition.quantity;
    case "object_inspected": return state.inspectedObjects.has(condition.objectId);
    case "puzzle_solved": return state.solvedPuzzles.has(condition.puzzleId);
    case "location_reached": return state.reachedLocations.has(condition.locationId);
    case "flag_equals": return state.flags[condition.key] === condition.value;
    case "all": return condition.conditions.every((c) => evaluateCondition(c, state));
    case "any": return condition.conditions.some((c) => evaluateCondition(c, state));
    case "not": return !evaluateCondition(condition.condition, state);
    default: return false;
  }
}

/** Collect all referenced entity ids (for validation). */
export function collectConditionRefs(condition: Condition): { missions: string[]; clues: string[]; items: string[]; objects: string[]; puzzles: string[]; locations: string[] } {
  const out = { missions: [] as string[], clues: [] as string[], items: [] as string[], objects: [] as string[], puzzles: [] as string[], locations: [] as string[] };
  const walk = (c: Condition): void => {
    switch (c.type) {
      case "mission_completed": out.missions.push(c.missionId); break;
      case "clue_discovered": out.clues.push(c.clueId); break;
      case "item_owned": out.items.push(c.itemId); break;
      case "object_inspected": out.objects.push(c.objectId); break;
      case "puzzle_solved": out.puzzles.push(c.puzzleId); break;
      case "location_reached": out.locations.push(c.locationId); break;
      case "all": case "any": c.conditions.forEach(walk); break;
      case "not": walk(c.condition); break;
      default: break;
    }
  };
  walk(condition);
  return out;
}
