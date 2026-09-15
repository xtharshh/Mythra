import { beforeEach, describe, expect, it } from "vitest";
import demo from "../../src/data/demo-world.json";
import type { World } from "../../src/types";
import { clearSession, ownerKey, saveOwner, saveSession } from "../../src/auth/auth";
import { loadVoiceNoteMetas, saveVoiceNoteMetas } from "../../src/audio/voiceNotes";
import { mergeCheckpoints, mergeLibrary, pruneLibraryForPersist, useLumen } from "../../src/state/store";

const world = demo as unknown as World;

// node test env has no DOM storage — minimal in-memory stand-in
const mem = new Map<string, string>();

function asUser(email: string | null): void {
  if (email) saveSession({ email, verifiedAt: "2026-09-14T00:00:00.000Z" });
  else clearSession();
}

beforeEach(() => {
  mem.clear();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => {
        mem.set(k, String(v));
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    },
    configurable: true,
    writable: true,
  });
  clearSession();
  useLumen.setState({
    world: null, worlds: [], contributions: [], versions: [],
    inventory: {}, discoveredClues: [], completedMissions: [], activeMissions: [],
    solvedPuzzles: [], inspectedObjects: [], reachedLocations: ["loc_landing"],
    flags: {}, notes: {}, voiceNotes: [], checkpoints: [],
    plays: {}, ratings: {}, playerPos: [0, 1.7, 6], log: [],
  });
});

describe("username-based game data", () => {
  it("keys storage per login; guests keep the legacy global key", () => {
    expect(saveOwner()).toBe("guest");
    expect(ownerKey("lumen-library-v1")).toBe("lumen-library-v1");
    expect(ownerKey("lumen-library-v1", "alice@x.com")).toBe("lumen-library-v1:alice@x.com");
    expect(ownerKey("lumen-library-v1", "Ivan R")).toBe("lumen-library-v1:ivan_r");
  });

  it("each explorer gets their own library, saves, plays and voice lists", () => {
    const s = () => useLumen.getState();

    // guest expedition: one world, some loot, saved
    s().addWorld(structuredClone(world));
    s().collect("metal", 3);
    s().save();
    s().recordPlay(world.id);

    // alice signs in → blank slate, no reload needed
    asUser("alice@x.com");
    s().switchUser();
    expect(s().worlds).toEqual([]);
    expect(s().inventory).toEqual({});
    expect(s().plays).toEqual({});
    expect(s().log.join(" ")).toMatch(/alice@x\.com/);

    // alice plays + saves her own run
    s().addWorld(structuredClone(world));
    s().collect("circuit", 5);
    s().save();
    s().recordPlay(world.id);

    // bob signs in → sees neither guest nor alice data
    asUser("bob@x.com");
    s().switchUser();
    expect(s().worlds).toEqual([]);
    expect(s().inventory).toEqual({});

    // alice returns → her world + her save snapshot restore
    asUser("alice@x.com");
    s().switchUser();
    expect(s().worlds.map((w) => w.id)).toContain(world.id);
    expect(s().inventory).toEqual({ circuit: 5 });
    expect(s().plays[world.id]).toBe(1);

    // sign out → guest data intact (legacy global key preserved)
    asUser(null);
    s().switchUser();
    expect(s().worlds.map((w) => w.id)).toContain(world.id);
    expect(s().inventory).toEqual({ metal: 3 });
    expect(s().plays[world.id]).toBe(1);
  });

  it("deletes unwanted stories with their saves", () => {
    const s = () => useLumen.getState();
    const a = { ...structuredClone(world), id: "w-a", slug: "w-a", name: "Story A" };
    const b = { ...structuredClone(world), id: "w-b", slug: "w-b", name: "Story B" };
    s().addWorld(a);
    s().collect("metal", 2);
    s().save();
    s().addWorld(b);
    expect(s().worlds.map((w) => w.id)).toEqual(["w-a", "w-b"]);
    s().deleteWorld("w-a");
    expect(s().worlds.map((w) => w.id)).toEqual(["w-b"]);
    expect(mem.get("lumen-save-v1:guest:w-a")).toBeUndefined();
    expect(s().world?.id).toBe("w-b");
    s().deleteWorld("w-b");
    expect(s().worlds).toEqual([]);
    expect(s().world).toBeNull();
    // last-open tale forgotten with it
    expect(mem.get("lumen-last-world")).toBeUndefined();
  });

  it("reload reopens the last tale (library + save survive)", () => {
    const s = () => useLumen.getState();
    const a = { ...structuredClone(world), id: "w-a", slug: "w-a", name: "Story A" };
    s().addWorld(a);
    s().collect("metal", 4);
    s().save();
    // simulate a fresh boot: memory wiped, storage kept
    useLumen.setState({ world: null, worlds: [], inventory: {}, log: [] });
    s().loadLibrary();
    expect(s().restoreLastWorld()).toBe(true);
    expect(s().world?.id).toBe("w-a");
    s().switchUser();
    expect(s().inventory).toEqual({ metal: 4 });
    // unknown last id → no restore, no crash
    mem.set("lumen-last-world", JSON.stringify("ghost"));
    useLumen.setState({ world: null });
    expect(s().restoreLastWorld()).toBe(false);
  });

  it("merges shelves newest-wins and checkpoints by union", () => {
    const local = { worlds: [], contributions: [], versions: [] };
    const remote = { worlds: [structuredClone(world)], contributions: [], versions: [] };
    expect(mergeLibrary(local, null, remote, "2026-09-14T10:00:00Z").fromRemote).toBe(true);
    expect(mergeLibrary(remote, "2026-09-14T10:00:00Z", local, "2026-09-14T09:00:00Z").fromRemote).toBe(false);
    expect(mergeLibrary(local, "2026-09-14T10:00:00Z", null, null).fromRemote).toBe(false);
    const cp = (id: string, label: string) => ({
      id, worldId: "w", owner: "guest", label, kind: "manual" as const,
      createdAt: "2026-09-14T10:00:00Z",
      snapshot: { inventory: {}, discoveredClues: [], completedMissions: [], activeMissions: [], solvedPuzzles: [], inspectedObjects: [], reachedLocations: [], flags: {}, notes: {} },
    });
    const merged = mergeCheckpoints([cp("1", "A")], [cp("1", "B"), cp("2", "C")]);
    expect(merged.map((c) => c.id).sort()).toEqual(["1", "2"]);
  });

  it("voice note lists are per-username", () => {
    asUser("alice@x.com");
    saveVoiceNoteMetas([
      { id: "n1", worldId: "w", targetKind: "clue", targetId: "c1", label: "L", author: "a", createdAt: "t", durationSec: 3, mime: "m" },
    ]);
    asUser("bob@x.com");
    expect(loadVoiceNoteMetas()).toEqual([]);
    asUser("alice@x.com");
    expect(loadVoiceNoteMetas().map((n) => n.id)).toEqual(["n1"]);
  });

  it("prunes history but never tales for quota retry", () => {
    const versions = Array.from({ length: 8 }, (_, i) => ({
      id: `v${i}`, worldId: "w", versionNumber: i + 1, snapshot: structuredClone(world),
      createdBy: "t", changeSummary: "t", createdAt: "2026-09-14T10:00:00Z",
    }));
    const pruned = pruneLibraryForPersist({
      worlds: [structuredClone(world)],
      contributions: Array.from({ length: 150 }, (_, i) => ({ kind: "clue" as const, id: `c${i}` })),
      versions,
    });
    expect(pruned.worlds).toHaveLength(1);
    expect(pruned.versions).toHaveLength(5);
    expect(pruned.versions.map((v) => v.versionNumber)).toEqual([8, 7, 6, 5, 4]);
    expect(pruned.contributions).toHaveLength(100);
  });
});
