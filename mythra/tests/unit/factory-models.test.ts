import { describe, expect, it } from "vitest";
import { createObjectMesh } from "../../src/three/factory";
import type { WorldObject } from "../../src/types";

function obj(modelId: string): WorldObject {
  return {
    id: `t_${modelId}`,
    type: "artifact",
    name: modelId,
    description: "",
    locationId: "loc_landing",
    position: [1, 2, 3],
    rotation: [0, 0.5, 0],
    scale: [1, 1, 1],
    modelId,
    visibility: "visible",
  };
}

const tick = (m: string) => (createObjectMesh(obj(m)).userData as { tick?: unknown }).tick;

describe("engine animates each model correctly — never generic, never frozen", () => {
  it("fires and crystals burn/breathe (animated)", () => {
    for (const m of ["campfire", "torch", "tree", "crystal", "core", "skychime"]) {
      expect(tick(m), m).toBeDefined();
    }
  });

  it("machines move like themselves (burst rotors, sweep, rattle, reels, lamps)", () => {
    for (const m of ["rover", "drone", "hatch", "beacon", "recorder", "locker", "maptable", "glyphwall", "survivor"]) {
      expect(tick(m), m).toBeDefined();
    }
  });

  it("dead things stay dead (static is correct for scrap/crates/tents)", () => {
    for (const m of ["scrap", "container", "tent", "helmet"]) {
      expect(tick(m), m).toBeUndefined();
    }
  });

  it("tags identity + transform for raycast/pulse systems", () => {
    const g = createObjectMesh(obj("torch"));
    expect(g.userData.objectId).toBe("t_torch");
    expect(g.position.toArray()).toEqual([1, 2, 3]);
    expect(g.children.length).toBeGreaterThan(2);
  });

  it("builds all 42 everyday objects (streets, rides, homes, cities)", () => {
    const ids = [
      "road", "streetlamp", "trafficlight", "bench", "trashbin", "mailbox",
      "hydrant", "busstop", "car", "truck", "bus", "motorcycle", "bicycle",
      "boat", "house", "bed", "table", "chair", "sofa", "floorlamp",
      "bookshelf", "tv", "fridge", "desk", "watercooler", "printer",
      "bush", "flower", "cactus", "palmtree", "pond", "fountain",
      "statue", "billboard", "windmill", "watertower", "gaspump", "barrel",
      "ladder", "telescope", "radio", "phonebooth",
    ];
    expect(ids).toHaveLength(42);
    for (const m of ids) {
      const g = createObjectMesh(obj(m));
      expect(g.children.length, m).toBeGreaterThanOrEqual(3);
      expect(g.userData.objectId, m).toBe(`t_${m}`);
    }
  });

  it("animates the living street objects", () => {
    for (const m of ["trafficlight", "streetlamp", "fountain", "windmill", "palmtree", "tv"]) {
      expect(tick(m), m).toBeDefined();
    }
  });

  it("builds the 6 metro pack models (train/tunnel animate)", () => {
    for (const m of ["train", "rails", "platform", "ticketgate", "tunnel", "stationsign"]) {
      const g = createObjectMesh(obj(m));
      expect(g.children.length, m).toBeGreaterThanOrEqual(3);
      expect(g.userData.objectId, m).toBe(`t_${m}`);
    }
    expect(tick("train"), "train").toBeDefined();
    expect(tick("tunnel"), "tunnel").toBeDefined();
    expect(tick("rails"), "rails").toBeUndefined();
    expect(tick("platform"), "platform").toBeUndefined();
  });
});
