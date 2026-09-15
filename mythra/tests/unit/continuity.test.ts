import { describe, expect, it } from "vitest";
import {
  applyContribution,
  chapterNumber,
  deriveTitleFromText,
  detectRequestedModels,
  detectRequestedPeople,
  forkWorld,
  makeContribution,
  nearestLocation,
  resolveContributionTitle,
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
    expect(validateContribution({ ...draft, text: "x".repeat(5001) }, world, [], "explorer").ok).toBe(false);
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
  it("approved clues materialize a 3D cache that reveals them", () => {
    const c = makeContribution({ ...draft, targetMissionId: "m3_rover" }, world.id, "explorer", true);
    const next = applyContribution(world, c);
    const clue = next.clues[next.clues.length - 1];
    const cache = next.objects.find((o) => o.interaction?.revealsClueId === clue.id);
    expect(cache).toBeDefined();
    expect(cache?.locationId).toBe(clue.locationId);
    expect(validateWorld(next).valid).toBe(true);
  });
  it("approved mission ideas become real missions with a 3D marker", () => {
    const open = { ...world, permissions: { ...world.permissions, allowMissionCreation: true } };
    const c = makeContribution({ kind: "mission_idea", title: "Light the ridge", text: "Haul a beacon to the ridge and light it so the next crew sees it." }, open.id, "explorer", true);
    const next = applyContribution(open, c);
    const mission = next.missions.find((m) => m.title === "Light the ridge");
    expect(mission).toBeDefined();
    expect(mission?.objectives).toHaveLength(1);
    const marker = next.objects.find((o) => o.interaction?.startsMissionId === mission?.id);
    expect(marker).toBeDefined();
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

describe("contribution titles (yours + named from your text)", () => {
  it("names a blank title from the text", () => {
    expect(resolveContributionTitle("", "Small boot prints lead away from the garage.")).toBe(
      "Small boot prints lead away from the garage",
    );
  });
  it("keeps a good title alone, combines when both add something", () => {
    expect(resolveContributionTitle("Footprints", "Footprints")).toBe("Footprints");
    const combined = resolveContributionTitle("Footprints", "Small boot prints lead away from the garage toward the ridge.");
    expect(combined).toContain("Footprints");
    expect(combined).toContain("Small boot prints");
    expect(combined.length).toBeLessThanOrEqual(80);
  });
  it("falls back instead of failing when the title is blank", () => {
    expect(validateContribution({ ...draft, title: "" }, world, [], "explorer")).toEqual({ ok: true });
    const c = makeContribution({ ...draft, title: "  " }, world.id, "explorer", false);
    expect(c.title.length).toBeGreaterThanOrEqual(3);
  });
  it("derives nothing useful from empty text", () => {
    expect(deriveTitleFromText("")).toBe("");
    expect(deriveTitleFromText("hi")).toBe("");
    expect(resolveContributionTitle("", "")).toBe("Untitled discovery");
  });
});

describe("chapter props materialize (named models become 3D)", () => {
  const chapterText = "You stand on the cracked platform. The old iron rails lie rusted. A single flickering bulb sways above. A paper map of the station flutters past. Old posters of trains line the walls. The train you imagined starts to materialize on the new rails.";
  it("detects the models a chapter names, in catalog order, capped", () => {
    const ids = detectRequestedModels("A New Track in the Old Station", chapterText).map((m) => m.id);
    expect(ids).toEqual(["train", "rails", "platform", "floorlamp", "billboard", "map"]);
  });
  it("never fires on lookalike words", () => {
    expect(detectRequestedModels("t", "I carry a card across the scar.")).toEqual([]);
  });
  it("grows inspectable props at the chapter site on approve", () => {
    const c = makeContribution(
      { kind: "story_fragment", title: "A New Track in the Old Station", text: chapterText, targetLocationId: world.locations[0].id },
      world.id, "Harsh Kumar", true,
    );
    const before = world.objects.length;
    const next = applyContribution(structuredClone(world), c);
    const props = next.objects.slice(before);
    expect(props.length).toBeGreaterThanOrEqual(3);
    expect(props.map((o) => o.modelId)).toContain("train");
    for (const o of props) {
      expect(o.locationId).toBe(world.locations[0].id);
      expect(o.interaction?.kind).toBe("inspect");
    }
    // approving twice never duplicates props
    expect(applyContribution(next, c).objects).toHaveLength(next.objects.length);
  });
  it("adds no props when the text names no models", () => {
    const c = makeContribution(
      { kind: "note", title: "Quiet wind", text: "The wind moved softly through the silent dunes tonight." },
      world.id, "Harsh Kumar", true,
    );
    expect(applyContribution(structuredClone(world), c).objects).toHaveLength(world.objects.length);
  });
  it("raises a hero and his power when the chapter calls", () => {
    const ids = detectRequestedModels("Rooftop oath", "A hero lands. Her mentor points at a glowing power orb.").map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(["hero", "powerup"]));
  });
  it("raises shops and a talking cast when the chapter asks", () => {
    const text = "Raise a tall building here. Below it open 2 shops, one meat and one grocery. Keep 2 people at their shops so I can talk to them as well.";
    expect(detectRequestedModels("Market row", text).map((m) => m.id)).toEqual(
      expect.arrayContaining(["building", "shop"]),
    );
    expect(detectRequestedPeople("Market row", text).map((p) => p.name)).toEqual(["Local 1", "Local 2"]);
    // "2 shops" must not inflate the cast
    expect(detectRequestedPeople("Stalls", "Open 2 shops and a market.")).toEqual([]);
    const c = makeContribution(
      { kind: "story_fragment", title: "Market row", text, targetLocationId: world.locations[0].id },
      world.id, "Harsh Kumar", true,
    );
    const next = applyContribution(structuredClone(world), c);
    const shop = next.objects.find((o) => o.modelId === "shop");
    expect(shop?.locationId).toBe(world.locations[0].id);
    const npcs = next.objects.filter((o) => o.id.startsWith(`obj_${c.id}_npc`));
    expect(npcs).toHaveLength(2);
    expect(npcs[0].interaction?.kind).toBe("talk");
    const cast = next.characters.slice(world.characters.length);
    expect(cast.map((ch) => ch.name)).toEqual(["Local 1", "Local 2"]);
    expect(cast[0].dialogue.length).toBeGreaterThan(0);
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
