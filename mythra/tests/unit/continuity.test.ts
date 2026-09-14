import { describe, expect, it } from "vitest";
import {
  applyContribution,
  chapterNumber,
  forkWorld,
  makeContribution,
  nearestLocation,
  snapshotVersion,
  validateContribution,
} from "../../src/community/continuity";
import { validateWorld } from "../../src/game/engines";
import demo from "../../src/data/demo-world.json";
import type { Contribution, World } from "../../src/types";

const world = structuredClone(demo) as unknown as World;
const draft = { kind: "clue" as const, title: "A second set of footprints", text: "Small boot prints lead away from the garage toward the ridge." };

describe("contribution validation", () => {
  it("accepts a good clue", () => {
    expect(validateContribution(draft, world, [], "explorer")).toEqual({ ok: true });
  });
  it("rejects short/empty text", () => {
    expect(validateContribution({ ...draft, text: "hi" }, world, [], "explorer").ok).toBe(false);
  });
  it("rejects overlong text", () => {
    expect(validateContribution({ ...draft, text: "x".repeat(601) }, world, [], "explorer").ok).toBe(false);
  });
  it("rejects kinds the creator didn't open", () => {
    const r = validateContribution({ ...draft, kind: "story_fragment" }, world, [], "explorer");
    expect(r.ok).toBe(false); // demo world: allowStoryChanges=false
  });
  it("rejects duplicates", () => {
    const c = makeContribution(draft, world.id, "explorer", false);
    expect(validateContribution(draft, world, [c], "explorer").ok).toBe(false);
  });
  it("rejects unknown mission links", () => {
    expect(validateContribution({ ...draft, targetMissionId: "nope" }, world, [], "explorer").ok).toBe(false);
  });
  it("caps pending queue per author", () => {
    const existing: Contribution[] = Array.from({ length: 5 }, (_, i) =>
      makeContribution({ ...draft, title: `Title ${i}` }, world.id, "explorer", false));
    expect(validateContribution(draft, world, existing, "explorer").ok).toBe(false);
  });
});

describe("applying contributions (story continues)", () => {
  it("approved clue becomes a valid, discoverable clue + version bump", () => {
    const c = makeContribution({ ...draft, targetMissionId: "m3_rover" }, world.id, "explorer", true);
    const next = applyContribution(world, c);
    expect(next.version).toBe(world.version + 1);
    expect(next.clues.length).toBe(world.clues.length + 1);
    expect(next.communityLog?.length).toBe(1);
    expect(validateWorld(next).valid).toBe(true);
  });
  it("story fragments extend the canon background", () => {
    const open = { ...world, permissions: { ...world.permissions, allowStoryChanges: true } };
    const c = makeContribution({ kind: "story_fragment", title: "The greenhouse", text: "Behind the water station, something green still grows in the dark." }, open.id, "explorer", true);
    const next = applyContribution(open, c);
    expect(next.story.background).toContain("The greenhouse");
    expect(validateWorld(next).valid).toBe(true);
  });
});

describe("forks + versions (new stories)", () => {
  it("fork creates an independent draft", () => {
    const fork = forkWorld(world);
    expect(fork.id).not.toBe(world.id);
    expect(fork.status).toBe("draft");
    expect(fork.version).toBe(1);
    expect(fork.name).toContain(world.name);
  });
  it("snapshots record history", () => {
    const v = snapshotVersion(world, "creator", "test snapshot");
    expect(v.worldId).toBe(world.id);
    expect(v.versionNumber).toBe(world.version);
    expect(v.snapshot.id).toBe(world.id);
  });
});

describe("chapters (continued stories)", () => {
  it("numbers tales from Chapter 1", () => {
    expect(chapterNumber(0)).toBe("Chapter 1");
    expect(chapterNumber(4)).toBe("Chapter 5");
  });
});

describe("nearestLocation (story where I'm standing)", () => {
  it("picks the closest site by XZ distance", () => {
    const near = nearestLocation([3, 1.7, 2], world.locations);
    expect(near?.id).toBe("loc_landing");
    const far = nearestLocation([22, 1.7, -10], world.locations);
    expect(far?.id).toBe("loc_water");
    expect(far!.dist).toBeGreaterThanOrEqual(0);
  });
  it("returns null with no locations", () => {
    expect(nearestLocation([0, 0, 0], [])).toBeNull();
  });
});
