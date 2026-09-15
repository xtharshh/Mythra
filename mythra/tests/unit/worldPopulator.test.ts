// World populator tests
import { describe, it, expect } from "vitest";
import { populateWorld } from "../../src/three/worldPopulator";
import type { World } from "../../src/types";

function makeTestWorld(overrides: Partial<World> = {}): World {
  return {
    id: "test-world",
    ownerId: "test",
    name: "Test World",
    slug: "test-world",
    description: "A test world",
    theme: "mars",
    status: "published",
    visibility: "public",
    difficulty: "easy",
    version: 1,
    environment: {
      type: "mars",
      skyColor: "#1a0b2e",
      fogColor: "#b5533c",
      primaryColor: "#c1553b",
      secondaryColor: "#7c3aed",
      gravity: 3.7,
      atmosphere: "thin",
      weather: "dust_storm",
      timeOfDay: "sunset",
      terrainSeed: 1337,
      ambientIntensity: 0.7,
    },
    story: {
      title: "Test",
      premise: "Test",
      background: "Test",
      centralConflict: "Test",
      playerRole: "Test",
      knownFacts: [],
      hiddenTruths: [],
      tone: "peaceful",
      canonicalEnding: "end",
    },
    locations: [
      { id: "loc_1", name: "Base Camp", description: "Start", position: [0, 0, 0], radius: 10, locked: false, tags: ["start"] },
      { id: "loc_2", name: "Outpost", description: "Mission", position: [20, 0, 0], radius: 8, locked: false, tags: ["mission"] },
      { id: "loc_3", name: "Hidden Cave", description: "Secret", position: [40, 0, 0], radius: 6, locked: true, tags: ["hidden"] },
    ],
    objects: [],
    characters: [],
    resources: [],
    missions: [],
    clues: [],
    clueConnections: [],
    puzzles: [],
    endings: [],
    permissions: { allowVisitors: true, allowClueCreation: true, allowBuilding: false, allowMissionCreation: false, allowStoryChanges: false, contributionMode: "approval_required" },
    settings: { sprintEnabled: true, worldBounds: 60 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("worldPopulator", () => {
  it("adds roads between nearby locations", () => {
    const world = makeTestWorld();
    populateWorld(world, { theme: "mars", seed: 12345, worldBounds: 60 });

    const roads = world.objects.filter(o => o.modelId === "road");
    expect(roads.length).toBeGreaterThan(0);
    // Should have road segments between loc_1 and loc_2 (distance 20 < 32)
    expect(roads.some(r => r.locationId === "loc_1")).toBe(true);
  });

  it("does not add roads to locked hidden locations", () => {
    const world = makeTestWorld();
    populateWorld(world, { theme: "mars", seed: 12345, worldBounds: 60 });

    const roads = world.objects.filter(o => o.modelId === "road");
    // loc_3 is locked and hidden, so no roads should connect to it
    expect(roads.some(r => r.locationId === "loc_3")).toBe(false);
  });

  it("adds streetlamps along roads", () => {
    const world = makeTestWorld();
    populateWorld(world, { theme: "mars", seed: 12345, worldBounds: 60 });

    const lamps = world.objects.filter(o => o.modelId === "streetlamp");
    expect(lamps.length).toBeGreaterThan(0);
  });

  it("populates each location area with ambient props", () => {
    const world = makeTestWorld();
    populateWorld(world, { theme: "mars", seed: 12345, worldBounds: 60 });

    // Each location should have procedural objects
    const procedural = world.objects.filter(o => o.metadata?.procedural);
    expect(procedural.length).toBeGreaterThan(0);

    // Should have mars-themed props (scrap, barrel, container, drone, etc.)
    const marsProps = procedural.filter(o =>
      ["scrap", "barrel", "container", "drone", "rover", "crystal"].includes(o.modelId ?? "")
    );
    expect(marsProps.length).toBeGreaterThan(0);
  });

  it("adds area lights near mission/start locations", () => {
    const world = makeTestWorld();
    populateWorld(world, { theme: "mars", seed: 12345, worldBounds: 60 });

    const areaLamps = world.objects.filter(o =>
      o.modelId === "streetlamp" && o.name === "Area Light"
    );
    expect(areaLamps.length).toBeGreaterThanOrEqual(3); // At least 3 for start location
  });

  it("adds landmark beacons at non-start unlocked locations", () => {
    const world = makeTestWorld();
    populateWorld(world, { theme: "mars", seed: 12345, worldBounds: 60 });

    const beacons = world.objects.filter(o =>
      o.type === "landmark" && o.name.includes("Beacon")
    );
    // loc_2 is unlocked and not start, should have a beacon
    expect(beacons.length).toBeGreaterThanOrEqual(1);
  });

  it("adds global ambient objects", () => {
    const world = makeTestWorld();
    populateWorld(world, { theme: "mars", seed: 12345, worldBounds: 60 });

    const global = world.objects.filter(o => o.metadata?.global === true);
    expect(global.length).toBeGreaterThan(0);
  });

  it("uses theme-appropriate prop pools", () => {
    const marsWorld = makeTestWorld({ theme: "mars" });
    populateWorld(marsWorld, { theme: "mars", seed: 12345, worldBounds: 60 });

    const fantasyWorld = makeTestWorld({ theme: "fantasy" });
    populateWorld(fantasyWorld, { theme: "fantasy", seed: 12345, worldBounds: 60 });

    const cyberWorld = makeTestWorld({ theme: "cyberpunk" });
    populateWorld(cyberWorld, { theme: "cyberpunk", seed: 12345, worldBounds: 60 });

    // Mars should have scrap, barrels, crystals
    const marsProps = marsWorld.objects.filter(o => o.metadata?.procedural).map(o => o.modelId);
    expect(marsProps.some(m => ["scrap", "barrel", "container", "crystal"].includes(m ?? ""))).toBe(true);

    // Fantasy should have trees, bushes, statues
    const fantasyProps = fantasyWorld.objects.filter(o => o.metadata?.procedural).map(o => o.modelId);
    expect(fantasyProps.some(m => ["tree", "bush", "statue", "campfire", "tent", "fountain"].includes(m ?? ""))).toBe(true);

    // Cyberpunk should have buildings, neon lamps, billboards
    const cyberProps = cyberWorld.objects.filter(o => o.metadata?.procedural).map(o => o.modelId);
    expect(cyberProps.some(m => ["building", "streetlamp", "bench", "billboard", "car"].includes(m ?? ""))).toBe(true);
  });

  it("is deterministic with same seed", () => {
    const world1 = makeTestWorld();
    const world2 = makeTestWorld();
    populateWorld(world1, { theme: "mars", seed: 42, worldBounds: 60 });
    populateWorld(world2, { theme: "mars", seed: 42, worldBounds: 60 });

    expect(world1.objects.length).toBe(world2.objects.length);
    for (let i = 0; i < world1.objects.length; i++) {
      expect(world1.objects[i].id).toBe(world2.objects[i].id);
      expect(world1.objects[i].position).toEqual(world2.objects[i].position);
    }
  });

  it("scales fill with the brief's density (low < medium < high)", () => {
    const counts: Record<string, number> = {};
    for (const density of ["low", "medium", "high"] as const) {
      const world = makeTestWorld();
      populateWorld(world, { theme: "mars", seed: 7, worldBounds: 60, density });
      counts[density] = world.objects.filter((o) => o.metadata?.procedural).length;
    }
    expect(counts.low).toBeGreaterThan(0);
    expect(counts.medium).toBeGreaterThan(counts.low);
    expect(counts.high).toBeGreaterThan(counts.medium);
  });

  it("fills every theme pool with buildable models", () => {
    for (const theme of ["space", "forest", "ancient_ruins", "post_apocalyptic"] as const) {
      const world = makeTestWorld({ theme });
      populateWorld(world, { theme, seed: 9, worldBounds: 60 });
      const proc = world.objects.filter((o) => o.metadata?.procedural);
      expect(proc.length, theme).toBeGreaterThan(10);
      const ids = new Set(proc.map((o) => o.modelId));
      expect(ids.size, theme).toBeGreaterThanOrEqual(3);
    }
  });

  it("biases fill by location role (supply at resources, markers at clues)", () => {
    const world = makeTestWorld({
      locations: [
        { id: "loc_res", name: "Depot", description: "", position: [0, 0, 0], radius: 8, locked: false, tags: ["resource"] },
        { id: "loc_clue", name: "Archive", description: "", position: [30, 0, 0], radius: 8, locked: false, tags: ["clue"] },
      ],
    });
    populateWorld(world, { theme: "mars", seed: 11, worldBounds: 60 });
    const at = (loc: string) => world.objects.filter((o) => o.locationId === loc && o.metadata?.procedural);
    const resSupply = at("loc_res").filter((o) => o.type === "container" || o.type === "resource_node");
    const clueMarks = at("loc_clue").filter((o) => o.type === "landmark");
    expect(resSupply.length).toBeGreaterThanOrEqual(3);
    expect(clueMarks.length).toBeGreaterThanOrEqual(2);
  });

  it("fills later areas too — neighbour sprawl never starves them", () => {
    const world = makeTestWorld({
      locations: [
        { id: "loc_a", name: "Alpha", description: "", position: [0, 0, 0], radius: 10, locked: false, tags: ["mission"] },
        { id: "loc_b", name: "Beta", description: "", position: [12, 0, 0], radius: 10, locked: false, tags: ["clue"] },
      ],
    });
    populateWorld(world, { theme: "mars", seed: 21, worldBounds: 60 });
    for (const id of ["loc_a", "loc_b"]) {
      const n = world.objects.filter((o) => o.locationId === id && o.metadata?.procedural).length;
      expect(n, id).toBeGreaterThanOrEqual(10);
    }
  });

  it("is idempotent — re-running never duplicates", () => {
    const world = makeTestWorld();
    populateWorld(world, { theme: "mars", seed: 42, worldBounds: 60 });
    const first = world.objects.length;
    populateWorld(world, { theme: "mars", seed: 42, worldBounds: 60 });
    expect(world.objects.length).toBe(first);
  });

  it("produces different results with different seeds", () => {
    const world1 = makeTestWorld();
    const world2 = makeTestWorld();
    populateWorld(world1, { theme: "mars", seed: 1, worldBounds: 60 });
    populateWorld(world2, { theme: "mars", seed: 2, worldBounds: 60 });

    // At least some objects should differ
    const diff = world1.objects.some((o, i) =>
      o.position[0] !== world2.objects[i]?.position[0] ||
      o.position[2] !== world2.objects[i]?.position[2] ||
      o.modelId !== world2.objects[i]?.modelId
    );
    expect(diff).toBe(true);
  });
});