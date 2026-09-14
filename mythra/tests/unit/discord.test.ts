import { afterEach, describe, expect, it, vi } from "vitest";
import { avatarUrl, discordAuthUrl, displayName } from "../../server/discord.js";

describe("discord oauth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a proper authorize URL", () => {
    vi.stubEnv("DISCORD_CLIENT_ID", "abc123");
    vi.stubEnv("DISCORD_REDIRECT_URI", "http://localhost:4000/api/auth/discord/callback");
    const url = new URL(discordAuthUrl("state-9"));
    expect(url.hostname).toBe("discord.com");
    expect(url.searchParams.get("client_id")).toBe("abc123");
    expect(url.searchParams.get("scope")).toBe("identify");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("state-9");
  });

  it("names users stably, prefers global names", () => {
    expect(displayName({ username: "ivan", globalName: "Ivan R" })).toBe("Ivan R");
    expect(displayName({ username: "ivan", globalName: "  " })).toBe("ivan");
  });

  it("resolves avatars, animated included", () => {
    expect(avatarUrl({ id: "1", avatar: null })).toBeNull();
    expect(avatarUrl({ id: "1", avatar: "a_abc" })).toMatch(/\.gif/);
    expect(avatarUrl({ id: "1", avatar: "abc" })).toMatch(/\.png/);
  });
});
