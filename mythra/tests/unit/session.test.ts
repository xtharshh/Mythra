import { beforeEach, describe, expect, it } from "vitest";
import { clearSession, isDiscordSession, loadSession, saveSession } from "../../src/auth/auth";

// node test env has no DOM storage — minimal in-memory stand-in
const mem = new Map<string, string>();

beforeEach(() => {
  mem.clear();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => {
        mem.set(k, String(v));
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    },
    configurable: true,
    writable: true,
  });
});

describe("explorer session (profile card data)", () => {
  it("round-trips Discord profile data for the username card", () => {
    saveSession({
      email: "Ivan R",
      verifiedAt: "2026-09-14T00:00:00.000Z",
      avatar: "https://cdn.discordapp.com/avatars/1/abc.png?size=64",
      discordId: "123",
      discordUsername: "ivan",
      displayName: "Ivan R",
    });
    const s = loadSession();
    expect(s?.discordId).toBe("123");
    expect(s?.discordUsername).toBe("ivan");
    expect(s?.displayName).toBe("Ivan R");
    expect(s?.avatar).toMatch(/discordapp/);
    expect(isDiscordSession(s)).toBe(true);
  });

  it("email sessions carry no Discord data", () => {
    saveSession({ email: "explorer@aurorabase.mars", verifiedAt: "2026-09-14T00:00:00.000Z" });
    const s = loadSession();
    expect(s?.email).toBe("explorer@aurorabase.mars");
    expect(isDiscordSession(s)).toBe(false);
  });

  it("legacy sessions (email only) still load, junk still rejected", () => {
    mem.set("lumen-auth-v1", JSON.stringify({ email: "old@x.com", verifiedAt: "t" }));
    expect(loadSession()?.email).toBe("old@x.com");
    mem.set("lumen-auth-v1", JSON.stringify({ email: "" }));
    expect(loadSession()).toBeNull();
    mem.set("lumen-auth-v1", "not json{{{");
    expect(loadSession()).toBeNull();
    clearSession();
    expect(loadSession()).toBeNull();
  });
});
