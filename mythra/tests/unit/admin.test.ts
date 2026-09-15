import { describe, expect, it } from "vitest";
import {
  adminEmails,
  attributedRoute,
  buildAdminStats,
  isAdminEmail,
  rollApiHits,
  rollCreators,
  splitUsers,
} from "../../server/admin";
import { adminLogin, clearAdmin, fetchAdminStats, loadAdmin, saveAdmin } from "../../src/admin/admin";

const ENV = { ADMIN_EMAILS: "Boss@Example.com, crew@example.com ", ADMIN_KEY: "s3cret" };

describe("admin gate", () => {
  it("parses the allowlist (trim + lowercase, drops empties)", () => {
    expect(adminEmails(ENV)).toEqual(["boss@example.com", "crew@example.com"]);
    expect(adminEmails({})).toEqual([]);
  });

  it("admits allowlisted emails only when a key is configured", () => {
    expect(isAdminEmail("boss@example.com", ENV)).toBe(true);
    expect(isAdminEmail("  CREW@example.com ", ENV)).toBe(true);
    expect(isAdminEmail("stranger@example.com", ENV)).toBe(false);
    expect(isAdminEmail("boss@example.com", { ADMIN_EMAILS: "boss@example.com" })).toBe(false);
    expect(isAdminEmail("", ENV)).toBe(false);
    expect(isAdminEmail(undefined, ENV)).toBe(false);
  });
});

describe("admin stats aggregation", () => {
  const worlds = [
    { id: "w1", owner: "boss@example.com", data: { name: "Red", theme: "mars", difficulty: "medium" } },
    { id: "w2", owner: "crew@example.com", data: { name: "Neon", theme: "cyberpunk", difficulty: "hard" } },
    { id: "w3", owner: "boss@example.com", data: {} },
  ];
  const boards = {
    w1: [
      { user: "ivan", missions: 3, clues: 5 },
      { user: "sol", missions: 1, clues: 1 },
    ],
    w2: [{ user: "ivan", missions: 5, clues: 2 }],
  };

  it("totals plays, solvers, and solves across worlds", () => {
    const s = buildAdminStats(worlds, boards, 0);
    expect(s.totals).toMatchObject({
      worlds: 3, owners: 2, plays: 3, solvers: 2, missionsSolved: 9, cluesFound: 8,
    });
    expect(s.generatedAt).toBe(new Date(0).toISOString());
  });

  it("splits by theme/difficulty and ranks top worlds first", () => {
    const s = buildAdminStats(worlds, boards, 0);
    expect(s.byTheme).toMatchObject({ mars: 1, cyberpunk: 1, unknown: 1 });
    expect(s.byDifficulty).toMatchObject({ medium: 1, hard: 1, unknown: 1 });
    expect(s.topWorlds.map((w) => w.id)).toEqual(["w1", "w2", "w3"]);
    expect(s.topWorlds[0]).toMatchObject({ plays: 2, solvers: 2, missions: 4, clues: 6 });
  });

  it("rolls players up across worlds", () => {
    const s = buildAdminStats(worlds, boards, 0);
    expect(s.topPlayers[0]).toMatchObject({ user: "ivan", worlds: 2, missions: 8, clues: 7 });
  });

  it("survives junk rows without throwing", () => {
    const s = buildAdminStats(
      [{ id: "x", owner: "", data: null }],
      { x: [{ user: 7, missions: "lots", clues: null }, null] } as never,
      0,
    );
    expect(s.totals).toMatchObject({ worlds: 1, owners: 0, plays: 1, solvers: 0 });
  });
});

describe("admin users split", () => {
  it("separates online from offline and matches discord by name", () => {
    const s = splitUsers(
      ["a@x.co", "b@x.co"],
      [{ id: "d1", username: "ivan", globalName: "Ivan R" }],
      [{ email: "a@x.co", worldId: "w1", suit: "s", ts: 1000 }, { email: "Ivan R", worldId: "w2", suit: "s", ts: 2000 }],
      3000,
    );
    expect(s.total).toBe(3);
    expect(s.onlineCount).toBe(2);
    expect(s.online.map((u) => u.email).sort()).toEqual(["Ivan R", "a@x.co"]);
    expect(s.offline).toEqual(["b@x.co"]);
    expect(s.discord).toMatchObject([{ id: "d1", name: "ivan", kind: "discord", online: true, worldId: "w2" }]);
  });

  it("dedupes repeat heartbeats and survives junk", () => {
    const s = splitUsers(["a@x.co"], [], [{ email: "a@x.co" }, { email: "a@x.co" }, null], 0);
    expect(s.onlineCount).toBe(1);
    expect(s.offline).toEqual([]);
  });
});

describe("admin api rollup", () => {
  const hits = [
    { ts: 1, method: "POST", route: "/api/worlds", status: 200, ms: 40, ip: "1.2.3.*", country: "IN", user: "a@x.co" },
    { ts: 2, method: "POST", route: "/api/worlds", status: 400, ms: 10, ip: "1.2.3.*", country: "IN", user: "b@x.co" },
    { ts: 3, method: "GET", route: "/api/worlds", status: 200, ms: 5, ip: "9.9.9.*", country: "unknown", user: "" },
    { ts: 4, method: "PUT", route: "/api/library", status: 200, ms: 12, ip: "1.2.3.*", country: "IN", user: "a@x.co" },
  ];

  it("attributes only creation/extension writes", () => {
    expect(attributedRoute("POST", "/api/worlds")).toBe(true);
    expect(attributedRoute("PUT", "/api/library")).toBe(true);
    expect(attributedRoute("PUT", "/api/checkpoints/w1")).toBe(true);
    expect(attributedRoute("POST", "/api/rooms")).toBe(true);
    expect(attributedRoute("GET", "/api/worlds")).toBe(false);
    expect(attributedRoute("POST", "/api/presence")).toBe(false);
  });

  it("rolls endpoints, countries, and recent hits", () => {
    const r = rollApiHits(hits, 99);
    expect(r.total).toBe(4);
    expect(r.errors).toBe(1);
    expect(r.byEndpoint[0]).toMatchObject({ route: "POST /api/worlds", hits: 2, errors: 1, avgMs: 25 });
    expect(r.byCountry).toContainEqual({ country: "IN", hits: 3 });
    expect(r.recent.map((h) => h.ts)).toEqual([4, 3, 2, 1]);
  });

  it("rolls per-user creations and extensions", () => {
    const rows = rollCreators([{ owner: "a@x.co" }, { owner: "" }], hits);
    expect(rows).toMatchObject([
      { user: "a@x.co", worldsPublished: 1, createAttempts: 1, createRejected: 0, librarySyncs: 1 },
      { user: "b@x.co", worldsPublished: 0, createAttempts: 1, createRejected: 1, librarySyncs: 0 },
    ]);
  });
});

describe("admin session", () => {
  it("round-trips safely headless (no storage → null, never throws)", () => {
    expect(loadAdmin()).toBeNull();
    expect(() => saveAdmin({ email: "a@b.co", token: "t", at: "" })).not.toThrow();
    expect(() => clearAdmin()).not.toThrow();
  });

  it("validates before touching the network", async () => {
    await expect(adminLogin("", "k")).rejects.toThrow(/admin email/i);
    await expect(adminLogin("a@b.co", "")).rejects.toThrow(/admin key/i);
  });

  it("fails soft with no backend", async () => {
    // hermetic: never touch a real backend even if one runs locally
    const realFetch = (globalThis as { fetch?: unknown }).fetch;
    (globalThis as { fetch?: unknown }).fetch = () => Promise.reject(new Error("down"));
    try {
      await expect(adminLogin("a@b.co", "k")).rejects.toThrow(/unreachable/i);
      await expect(fetchAdminStats("t")).rejects.toThrow(/unreachable/i);
    } finally {
      (globalThis as { fetch?: unknown }).fetch = realFetch;
    }
  });
});
