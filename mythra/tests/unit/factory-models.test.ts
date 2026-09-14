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
});
