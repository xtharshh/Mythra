import { describe, expect, it } from "vitest";
import demo from "../../src/data/demo-world.json";
import type { World } from "../../src/types";
import { applyUserTitle } from "../../src/components/WorldPreview";

const world = structuredClone(demo) as unknown as World;

describe("planner titles (yours stamps the tale)", () => {
  it("leaves the AI name when blank", () => {
    expect(applyUserTitle(world, "").name).toBe(world.name);
    expect(applyUserTitle(world, "   ").slug).toBe(world.slug);
  });

  it("stamps name, story title and a URL-safe slug", () => {
    const stamped = applyUserTitle(world, "  The Silent Mars Colony! ");
    expect(stamped.name).toBe("The Silent Mars Colony!");
    expect(stamped.story.title).toBe("The Silent Mars Colony!");
    expect(stamped.slug).toMatch(/^the-silent-mars-colony-[a-z0-9]+$/);
    expect(stamped.id).toBe(world.id);
  });

  it("caps runaway titles", () => {
    const stamped = applyUserTitle(world, "x".repeat(200));
    expect(stamped.name.length).toBe(80);
  });
});
