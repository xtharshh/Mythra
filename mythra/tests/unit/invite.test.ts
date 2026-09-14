import { describe, expect, it } from "vitest";
import demo from "../../src/data/demo-world.json";
import { buildInviteLink, buildShortInviteLink, parseInvite, parseRoomId, rankRacers } from "../../src/game/invite";
import { exportWorldCode } from "../../src/game/share";
import type { World } from "../../src/types";

const world = structuredClone(demo) as unknown as World;

describe("party invites", () => {
  it("round-trips room + tale through the link", () => {
    const link = buildInviteLink("abc123", world);
    expect(link).toMatch(/\/play\?invite=/);
    const payload = parseInvite(link.split("invite=")[1]);
    expect(payload.room).toBe("abc123");
    expect(payload.code).toBe(exportWorldCode(world));
  });

  it("rejects garbage links readably", () => {
    expect(() => parseInvite("%%%")).toThrow(/resend/i);
    expect(() => parseInvite(btoa("{\"v\":2}"))).toThrow(/MYTHRA party/i);
  });

  it("short links stay pocket-sized and validate room ids", () => {
    const link = buildShortInviteLink("705295");
    expect(link).toMatch(/\/play\?room=705295$/);
    expect(link.length).toBeLessThan(100);
    expect(parseRoomId("705295")).toBe("705295");
    expect(parseRoomId("  A1B2C3 ")).toBe("a1b2c3");
    expect(() => parseRoomId("nope")).toThrow(/resend/i);
    expect(() => parseRoomId("")).toThrow(/resend/i);
  });
});

describe("rankRacers (who solves faster)", () => {
  const row = (user: string, missions: number, clues: number, startedAt: string, finishedAt?: string) => ({
    user, missions, clues, startedAt, updatedAt: startedAt, ...(finishedAt ? { finishedAt } : {}),
  });

  it("orders missions, then clues, then earliest finish", () => {
    const racers = [
      row("slow", 2, 9, "2026-01-01T00:00:00Z"),
      row("fast", 3, 1, "2026-01-01T00:05:00Z"),
      row("champ", 3, 4, "2026-01-01T00:03:00Z", "2026-01-01T01:00:00Z"),
      row("champ2", 3, 4, "2026-01-01T00:01:00Z", "2026-01-01T00:50:00Z"),
    ];
    expect(rankRacers(racers).map((r) => r.user)).toEqual(["champ2", "champ", "fast", "slow"]);
  });

  it("unfinished never outranks finished on ties", () => {
    const racers = [row("a", 5, 9, "2026-01-01T00:00:00Z"), row("b", 5, 9, "2026-01-01T00:01:00Z", "2026-01-01T02:00:00Z")];
    expect(rankRacers(racers)[0].user).toBe("b");
  });
});
