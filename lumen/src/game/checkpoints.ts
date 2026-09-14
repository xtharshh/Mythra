// Checkpoint saves (skills.md G10): named progress snapshots per owner+world.
// Manual ("Save checkpoint") plus auto (mission complete, new location).
// Pure list logic here (tested); persistence lives in the Zustand store.

export type CheckpointKind = "auto" | "manual";

export interface CheckpointSnapshot {
  inventory: Record<string, number>;
  discoveredClues: string[];
  completedMissions: string[];
  activeMissions: string[];
  solvedPuzzles: string[];
  inspectedObjects: string[];
  reachedLocations: string[];
  flags: Record<string, string | number | boolean>;
  notes: Record<string, string>;
  playerPos?: [number, number, number];
}

export interface Checkpoint {
  id: string;
  worldId: string;
  owner: string;
  label: string;
  kind: CheckpointKind;
  createdAt: string;
  snapshot: CheckpointSnapshot;
}

export const MAX_CHECKPOINTS = 12;

export function checkpointKey(owner: string, worldId: string): string {
  return `lumen-checkpoints-v1:${owner}:${worldId}`;
}

export function makeCheckpointId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `cp_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/**
 * Cap the list: manual checkpoints win over auto, newest wins within kind.
 * Returns a new array, newest-first.
 */
export function pruneCheckpoints(list: Checkpoint[], max = MAX_CHECKPOINTS): Checkpoint[] {
  const sorted = list
    .slice()
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "manual" ? -1 : 1;
      return a.createdAt < b.createdAt ? 1 : -1;
    })
    .slice(0, Math.max(0, max));
  // display order: newest first regardless of kind
  return sorted.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
