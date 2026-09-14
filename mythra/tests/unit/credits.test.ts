import { describe, expect, it } from "vitest";
import { discoverVerb, explorerName, ownerLabel } from "../../src/game/credits";

describe("credits (usernames on stories)", () => {
  it("labels owners without prefixes", () => {
    expect(ownerLabel("creator-lumen")).toBe("lumen");
    expect(ownerLabel("author-you")).toBe("you");
    expect(ownerLabel("HARSH")).toBe("HARSH");
    expect(ownerLabel("")).toBe("unknown");
  });

  it("falls back to guest headless", () => {
    expect(explorerName()).toBe("guest explorer");
  });

  it("verbs every discovery method", () => {
    expect(discoverVerb("inspect")).toBe("Inspect");
    expect(discoverVerb("talk")).toBe("Talk at");
    expect(discoverVerb("observe")).toBe("Find near");
    expect(discoverVerb("???")).toBe("Discover at");
  });
});
