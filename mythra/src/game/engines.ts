// Game engines: validation (§13), mission/clue/puzzle/inventory logic (§8–10).
import { worldSchema } from "../schemas";
import type { GameState, ValidationReport, World } from "../types";
import { collectConditionRefs, evaluateCondition } from "./conditions";

export function validateWorld(world: World): ValidationReport {
  const errors: ValidationReport["errors"] = [];
  const warnings: ValidationReport["warnings"] = [];
  const suggestions: ValidationReport["suggestions"] = [];

  const parsed = worldSchema.safeParse(world);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({ code: "SCHEMA", message: `${issue.path.join(".")}: ${issue.message}` });
    }
  }

  const locIds = new Set(world.locations.map((l) => l.id));
  const objIds = new Set(world.objects.map((o) => o.id));
  const missionIds = new Set(world.missions.map((m) => m.id));
  const clueIds = new Set(world.clues.map((c) => c.id));
  const puzzleIds = new Set(world.puzzles.map((p) => p.id));
  const resourceIds = new Set(world.resources.map((r) => r.id));
  const unique = (arr: string[]) => new Set(arr).size === arr.length;

  if (!unique(world.locations.map((l) => l.id))) errors.push({ code: "DUP_LOCATION", message: "Duplicate location ids" });
  if (!unique(world.objects.map((o) => o.id))) errors.push({ code: "DUP_OBJECT", message: "Duplicate object ids" });
  if (!unique(world.missions.map((m) => m.id))) errors.push({ code: "DUP_MISSION", message: "Duplicate mission ids" });
  if (!unique(world.clues.map((c) => c.id))) errors.push({ code: "DUP_CLUE", message: "Duplicate clue ids" });

  // Referential checks
  for (const o of world.objects) {
    if (!locIds.has(o.locationId)) errors.push({ code: "REF_LOCATION", message: `Object ${o.id} references unknown location ${o.locationId}`, entityId: o.id });
    if (o.interaction?.revealsClueId && !clueIds.has(o.interaction.revealsClueId)) errors.push({ code: "REF_CLUE", message: `Object ${o.id} reveals unknown clue`, entityId: o.id });
    if (o.interaction?.opensPuzzleId && !puzzleIds.has(o.interaction.opensPuzzleId)) errors.push({ code: "REF_PUZZLE", message: `Object ${o.id} opens unknown puzzle`, entityId: o.id });
  }
  for (const c of world.clues) {
    if (!locIds.has(c.locationId)) errors.push({ code: "REF_LOCATION", message: `Clue ${c.id} has unknown location`, entityId: c.id });
    if (c.objectId && !objIds.has(c.objectId)) errors.push({ code: "REF_OBJECT", message: `Clue ${c.id} references unknown object`, entityId: c.id });
    if (c.relatedMissionId && !missionIds.has(c.relatedMissionId)) errors.push({ code: "REF_MISSION", message: `Clue ${c.id} references unknown mission`, entityId: c.id });
  }
  for (const p of world.puzzles) {
    if (!locIds.has(p.locationId)) errors.push({ code: "REF_LOCATION", message: `Puzzle ${p.id} has unknown location`, entityId: p.id });
    for (const cid of p.relatedClueIds) if (!clueIds.has(cid)) errors.push({ code: "REF_CLUE", message: `Puzzle ${p.id} references unknown clue ${cid}`, entityId: p.id });
    if (!p.solutionHash) errors.push({ code: "PUZZLE_NO_SOLUTION", message: `Puzzle ${p.id} has no solution`, entityId: p.id });
  }
  for (const m of world.missions) {
    if (m.objectives.length === 0) errors.push({ code: "MISSION_NO_OBJECTIVES", message: `Mission ${m.id} has no objectives`, entityId: m.id });
    for (const cond of [...m.prerequisites, m.startCondition, m.completionCondition]) {
      const refs = collectConditionRefs(cond);
      for (const id of refs.missions) if (!missionIds.has(id)) errors.push({ code: "REF_MISSION", message: `Mission ${m.id} references unknown mission ${id}`, entityId: m.id });
      for (const id of refs.clues) if (!clueIds.has(id)) errors.push({ code: "REF_CLUE", message: `Mission ${m.id} references unknown clue ${id}`, entityId: m.id });
      for (const id of refs.objects) if (!objIds.has(id)) errors.push({ code: "REF_OBJECT", message: `Mission ${m.id} references unknown object ${id}`, entityId: m.id });
      for (const id of refs.puzzles) if (!puzzleIds.has(id)) errors.push({ code: "REF_PUZZLE", message: `Mission ${m.id} references unknown puzzle ${id}`, entityId: m.id });
      for (const id of refs.locations) if (!locIds.has(id)) errors.push({ code: "REF_LOCATION", message: `Mission ${m.id} references unknown location ${id}`, entityId: m.id });
      for (const id of refs.items) if (!resourceIds.has(id)) errors.push({ code: "REF_ITEM", message: `Mission ${m.id} references unknown item ${id}`, entityId: m.id });
    }
    for (const r of m.rewards) {
      if (r.itemId && !resourceIds.has(r.itemId)) errors.push({ code: "REF_ITEM", message: `Mission ${m.id} rewards unknown item`, entityId: m.id });
    }
  }

  // Dependency cycle detection (mission prerequisites referencing missions)
  const missionDeps = new Map<string, string[]>();
  for (const m of world.missions) {
    const deps = new Set<string>();
    for (const cond of m.prerequisites) {
      for (const id of collectConditionRefs(cond).missions) deps.add(id);
    }
    const startRefs = collectConditionRefs(m.startCondition).missions;
    startRefs.forEach((d) => deps.add(d));
    missionDeps.set(m.id, [...deps]);
  }
  if (hasCycle(missionDeps)) errors.push({ code: "MISSION_CYCLE", message: "Circular mission dependencies detected" });

  // Critical clues must have valid location (reachability simplified: location exists & not locked without unlock path)
  const lockedWithoutPath = world.locations.filter((l) => l.locked && !l.unlockCondition);
  for (const c of world.clues.filter((c) => c.importance === "critical")) {
    if (lockedWithoutPath.some((l) => l.id === c.locationId)) {
      errors.push({ code: "CLUE_UNREACHABLE", message: `Critical clue ${c.id} is in locked location without unlock path`, entityId: c.id });
    }
  }
  for (const l of lockedWithoutPath) warnings.push({ code: "LOCATION_LOCKED", message: `Location ${l.id} locked with no unlock condition`, entityId: l.id });

  // Resource obtainability: every item_owned / collect objective item must be granted by some interaction or reward or resource def
  const obtainable = new Set<string>();
  for (const o of world.objects) if (o.interaction?.givesItemId) obtainable.add(o.interaction.givesItemId);
  for (const m of world.missions) for (const r of m.rewards) if (r.itemId) obtainable.add(r.itemId);
  for (const p of world.puzzles) for (const r of p.rewards) if (r.itemId) obtainable.add(r.itemId);
  for (const r of world.resources) {
    // resources defined but only obtainable if granted somewhere — warn otherwise
    if (!obtainable.has(r.id)) suggestions.push({ code: "RESOURCE_UNOBTAINABLE", message: `Resource ${r.id} is defined but never granted`, entityId: r.id });
  }

  const estimatedMinutes = world.missions.reduce((s, m) => s + m.estimatedMinutes, 0);
  const reachableLocations = world.locations.filter((l) => !lockedWithoutPath.includes(l)).length;

  return {
    valid: errors.length === 0,
    errors, warnings, suggestions,
    estimatedMinutes,
    missionCount: world.missions.length,
    clueCount: world.clues.length,
    puzzleCount: world.puzzles.length,
    reachableLocations,
    unreachableLocations: world.locations.length - reachableLocations,
  };
}

function hasCycle(graph: Map<string, string[]>): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const dfs = (n: string): boolean => {
    if (visiting.has(n)) return true;
    if (visited.has(n)) return false;
    visiting.add(n);
    for (const dep of graph.get(n) ?? []) if (dfs(dep)) return true;
    visiting.delete(n);
    visited.add(n);
    return false;
  };
  for (const k of graph.keys()) if (dfs(k)) return true;
  return false;
}

export type MissionStatus = "locked" | "available" | "active" | "completed" | "failed";

export function missionStatus(world: World, missionId: string, state: GameState, activeMissions: Set<string>): MissionStatus {
  const m = world.missions.find((x) => x.id === missionId);
  if (!m) return "locked";
  if (state.completedMissions.has(missionId)) return "completed";
  if (!m.prerequisites.every((c) => evaluateCondition(c, state))) return "locked";
  if (!evaluateCondition(m.startCondition, state)) return "locked";
  if (activeMissions.has(missionId)) return "active";
  return "available";
}

/** Check mission completion from objectives snapshot. Returns true if completionCondition holds. */
export function isMissionComplete(world: World, missionId: string, state: GameState): boolean {
  const m = world.missions.find((x) => x.id === missionId);
  if (!m) return false;
  return evaluateCondition(m.completionCondition, state);
}

export interface ObjectiveProgress {
  have: number;
  need: number;
  done: boolean;
}

/** Live have/need for one mission objective — powers the tracker's progress. Pure. */
export function objectiveProgress(
  o: { type: string; targetId?: string; quantity?: number },
  state: GameState,
): ObjectiveProgress {
  const need = Math.max(1, o.quantity ?? 1);
  const has = (set: Set<string>, id?: string): ObjectiveProgress => {
    const done = !!id && set.has(id);
    return { have: done ? need : 0, need, done };
  };
  switch (o.type) {
    case "collect_item": {
      const have = o.targetId ? (state.inventory[o.targetId] ?? 0) : 0;
      return { have: Math.min(have, need), need, done: have >= need };
    }
    case "inspect_object":
      return has(state.inspectedObjects, o.targetId);
    case "reach_location":
      return has(state.reachedLocations, o.targetId);
    case "solve_puzzle":
      return has(state.solvedPuzzles, o.targetId);
    case "discover_clue":
      return has(state.discoveredClues, o.targetId);
    case "talk_to_npc":
      return has(state.inspectedObjects, o.targetId);
    case "activate_machine":
    case "repair_object":
    case "build_structure":
      return has(state.inspectedObjects, o.targetId);
    case "deliver_item": {
      const have = o.targetId ? (state.inventory[o.targetId] ?? 0) : 0;
      return { have: Math.min(have, need), need, done: have >= need };
    }
    default:
      return { have: 0, need, done: false };
  }
}

export function canDiscoverClue(world: World, clueId: string, state: GameState): boolean {
  const clue = world.clues.find((c) => c.id === clueId);
  if (!clue || state.discoveredClues.has(clueId)) return false;
  if (clue.visibility === "requires_item" && clue.requiredItemId) {
    if ((state.inventory[clue.requiredItemId] ?? 0) < 1) return false;
  }
  if (clue.visibility === "requires_mission" && clue.requiredMissionId) {
    if (!state.completedMissions.has(clue.requiredMissionId)) return false;
  }
  return true;
}

/** Demo-safe puzzle check: compares normalized input to solution or solutionHash (mock). */
export function checkPuzzleAnswer(input: string, expected?: string, expectedHash?: string): boolean {
  const norm = input.trim().toLowerCase();
  if (expected && norm === expected.trim().toLowerCase()) return true;
  if (expectedHash) {
    // mock hash = "hash:<lowercased>"
    if (expectedHash === `hash:${norm}`) return true;
    if (expectedHash === norm) return true;
  }
  return false;
}

export function emptyGameState(): GameState {
  return { completedMissions: new Set(), discoveredClues: new Set(), inventory: {}, inspectedObjects: new Set(), solvedPuzzles: new Set(), reachedLocations: new Set(), flags: {} };
}
