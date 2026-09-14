import { describe, expect, it } from "vitest";
import { milestoneLinks, milestoneText } from "../../src/social/milestone";
import type { MilestoneStats } from "../../src/social/milestone";

const stats: MilestoneStats = {
  user: "ivan",
  worldName: "Silent Mars Colony",
  theme: "mars",
  missions: 5,
  missionsTotal: 5,
  clues: 9,
  cluesTotal: 9,
  date: "2026-01-01",
};

describe("milestone share", () => {
  it("brags with numbers", () => {
    const t = milestoneText(stats);
    expect(t).toMatch(/Silent Mars Colony/);
    expect(t).toMatch(/5\/5 missions/);
    expect(t).toMatch(/ivan/);
  });

  it("links every lane", () => {
    const links = milestoneLinks("hi", "https://x.test");
    for (const name of ["X", "WhatsApp", "Telegram", "Facebook", "LinkedIn"]) {
      expect(links.some((l) => l.label === name)).toBe(true);
    }
    expect(links[0].href).toMatch(/^https:\/\//);
  });
});
