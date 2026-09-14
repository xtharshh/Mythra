// Discord OAuth (server-side; secret never leaves this box).
// Setup: Discord Developer Portal → application → OAuth2 → redirect
//   ${REDIRECT_URI}/api/auth/discord/callback  → copy client id + secret
//   into env (see mythra/.env.example). Scopes: identify only.
import { randomBytes } from "node:crypto";

export interface DiscordProfile {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
}

export function discordEnv(): { clientId: string; clientSecret: string; redirectUri: string; frontendUrl: string } {
  const apiBase = (process.env.API_BASE ?? "").replace(/\/$/, "");
  return {
    clientId: process.env.DISCORD_CLIENT_ID ?? "",
    clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
    redirectUri: process.env.DISCORD_REDIRECT_URI ?? (apiBase ? `${apiBase}/api/auth/discord/callback` : "http://localhost:4000/api/auth/discord/callback"),
    frontendUrl: (process.env.FRONTEND_URL ?? "http://localhost:5173").replace(/\/$/, ""),
  };
}

export function discordConfigured(): boolean {
  const env = discordEnv();
  return env.clientId.length > 0 && env.clientSecret.length > 0;
}

/** Login URL for the Sign in with Discord button. Pure — tested. */
export function discordAuthUrl(state: string): string {
  const env = discordEnv();
  const q = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    response_type: "code",
    scope: "identify",
    state,
  });
  return `https://discord.com/api/oauth2/authorize?${q.toString()}`;
}

export function newState(): string {
  return randomBytes(16).toString("hex");
}

export async function exchangeCode(code: string): Promise<{ accessToken: string }> {
  const env = discordEnv();
  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: env.redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Discord token exchange failed (${res.status}).`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Discord gave no token.");
  return { accessToken: data.access_token };
}

export async function fetchProfile(accessToken: string): Promise<DiscordProfile> {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Discord profile fetch failed (${res.status}).`);
  const data = (await res.json()) as { id?: string; username?: string; global_name?: string | null; avatar?: string | null };
  if (!data.id || !data.username) throw new Error("Discord gave no profile.");
  return { id: data.id, username: data.username, globalName: data.global_name ?? null, avatar: data.avatar ?? null };
}

/** Display name everywhere: global name first, username always stable. Pure. */
export function displayName(p: Pick<DiscordProfile, "username" | "globalName">): string {
  return p.globalName?.trim() || p.username;
}

export function avatarUrl(p: Pick<DiscordProfile, "id" | "avatar">): string | null {
  if (!p.avatar) return null;
  const ext = p.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.${ext}?size=64`;
}
