import { describe, expect, it } from "vitest";
import { hashUser, suitForUser } from "../../src/game/suits";

describe("scenario suits", () => {
  it("is stable per explorer", () => {
    expect(suitForUser("ivan", "mars")).toEqual(suitForUser("IVAN", "mars"));
    expect(hashUser("a")).not.toBe(hashUser("b"));
  });

  it("dresses the theme (mars dust, ocean dive, fallback kit)", () => {
    expect(suitForUser("ivan", "mars").label).toBe("dust ops");
    expect(suitForUser("ivan", "ocean").label).toBe("dive rig");
    expect(suitForUser("ivan", "nope").label).toBe("field kit");
    expect(suitForUser("ivan", "mars").suit).not.toBe(suitForUser("ivan", "ocean").suit);
  });
});
