import { describe, expect, it } from "vitest";
import { MAX_CHECKPOINTS, checkpointKey, pruneCheckpoints } from "../../src/game/checkpoints";
import type { Checkpoint } from "../../src/game/checkpoints";

function cp(id: string, kind: Checkpoint["kind"], createdAt: string): Checkpoint {
  return {
    id, worldId: "w1", owner: "a@b.co", label: id, kind, createdAt,
    snapshot: {
      inventory: {}, discoveredClues: [], completedMissions: [], activeMissions: [],
      solvedPuzzles: [], inspectedObjects: [], reachedLocations: [], flags: {}, notes: {},
    },
  };
}

describe("checkpoints", () => {
  it("namespaces keys per explorer + world", () => {
    expect(checkpointKey("a@b.co", "w1")).toContain("a@b.co");
    expect(checkpointKey("a@b.co", "w1")).toContain("w1");
    expect(checkpointKey("a@b.co", "w1")).not.toBe(checkpointKey("c@d.co", "w1"));
  });

  it("keeps manual over auto and caps the list", () => {
    const list: Checkpoint[] = [];
    for (let i = 0; i < MAX_CHECKPOINTS + 4; i++) {
      list.push(cp(`auto-${i}`, "auto", `2026-01-01T00:${String(i).padStart(2, "0")}:00Z`));
    }
    list.push(cp("manual-keep", "manual", "2026-01-01T00:00:00Z"));
    const pruned = pruneCheckpoints(list);
    expect(pruned.length).toBe(MAX_CHECKPOINTS);
    expect(pruned.some((c) => c.id === "manual-keep")).toBe(true);
  });

  it("orders newest first", () => {
    const pruned = pruneCheckpoints([
      cp("old", "manual", "2026-01-01T00:00:00Z"),
      cp("new", "manual", "2026-02-01T00:00:00Z"),
    ]);
    expect(pruned[0].id).toBe("new");
  });
});
