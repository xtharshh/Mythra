// MYTHRA API client — talks to the Fastify backend when VITE_API_URL is set,
// otherwise every call resolves local-only (null) and the game plays offline.
// Auth token lives in localStorage next to the email session.
import type { Contribution, World, WorldVersion } from "../types";

const TOKEN_KEY = "lumen-api-token";

export function apiBase(): string | null {
  try {
    const base = import.meta.env.VITE_API_URL as string | undefined;
    if (base) return base.replace(/\/$/, "");
  } catch {
    /* no Vite env */
  }
  // same-origin API (Vercel: frontend + functions on one domain).
  // Unreachable backends fail soft to null → the game plays offline.
  try {
    return typeof window !== "undefined" && window.location?.origin ? window.location.origin : null;
  } catch {
    return null;
  }
}

export const apiOn = (): boolean => apiBase() !== null;

/** OAuth entry for Sign in with Discord (null when API is off). */
export function discordLoginUrl(): string | null {
  const base = apiBase();
  return base ? `${base}/api/auth/discord` : null;
}

/** Round-trip latency to the API in ms, or null when unreachable. */
export async function pingApi(): Promise<number | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const t0 = performance.now();
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return Math.round(performance.now() - t0);
  } catch {
    return null;
  }
}

/** Human ping for the station chip. Pure. */
export function formatPing(ms: number | null, connected: boolean): string {
  if (!connected) return "local";
  if (ms === null) return "offline";
  if (ms < 100) return `${ms}ms · fast`;
  if (ms < 400) return `${ms}ms`;
  return `${ms}ms · slow`;
}

export function apiToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setApiToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function call<T>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (opts.auth) {
      const token = apiToken();
      if (!token) return null;
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${base}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface RemoteWorldMeta {
  id: string;
  name: string;
  slug: string;
  theme: string;
  difficulty: string;
  missions: unknown[];
  clues: unknown[];
  puzzles: unknown[];
  plays: number;
  solvers: number;
  ownerId?: string;
  updatedAt?: string;
}

export interface BoardEntry {
  user: string;
  worldId: string;
  missions: number;
  clues: number;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface PresencePeer {
  user: string;
  pos: [number, number, number];
  suit: string;
}

export const api = {
  requestCode: (email: string) => call<{ email: string; code: string; demo: boolean }>("/api/auth/code", { method: "POST", body: { email } }),
  verifyCode: (email: string, code: string) => call<{ token: string; email: string }>("/api/auth/verify", { method: "POST", body: { email, code } }),
  worlds: () => call<RemoteWorldMeta[]>("/api/worlds"),
  world: (id: string) => call<World>(`/api/worlds/${encodeURIComponent(id)}`),
  publish: (world: World) => call<{ ok: boolean; id: string }>("/api/worlds", { method: "POST", body: world, auth: true }),
  saveProgress: (worldId: string, snapshot: unknown) => call<{ ok: boolean }>("/api/progress", { method: "POST", body: { worldId, snapshot }, auth: true }),
  loadProgress: (worldId: string) => call<Record<string, unknown>>(`/api/progress/${encodeURIComponent(worldId)}`, { auth: true }),
  library: () => call<{ data: { worlds?: World[]; contributions?: Contribution[]; versions?: WorldVersion[] }; updatedAt: string }>("/api/library", { auth: true }),
  pushLibrary: (data: unknown) => call<{ ok: boolean; updatedAt: string }>("/api/library", { method: "PUT", body: { data }, auth: true }),
  checkpoints: (worldId: string) =>
    call<{ data: unknown[]; updatedAt: string }>(`/api/checkpoints/${encodeURIComponent(worldId)}`, { auth: true }),
  pushCheckpoints: (worldId: string, checkpoints: unknown[]) =>
    call<{ ok: boolean; updatedAt: string }>(`/api/checkpoints/${encodeURIComponent(worldId)}`, { method: "PUT", body: { checkpoints }, auth: true }),
  submitScore: (worldId: string, missions: number, clues: number) =>
    call<{ ok: boolean }>("/api/leaderboard", { method: "POST", body: { worldId, missions, clues }, auth: true }),
  board: (worldId?: string) =>
    call<BoardEntry[] | Record<string, BoardEntry[]>>(worldId ? `/api/leaderboard?worldId=${encodeURIComponent(worldId)}` : "/api/leaderboard"),
  heartbeat: (worldId: string, pos: [number, number, number], suit: string, roomId?: string) =>
    call<{ ok: boolean }>("/api/presence", { method: "POST", body: { worldId, pos, suit, roomId: roomId ?? "" }, auth: true }),
  peers: (worldId: string, roomId?: string) =>
    call<PresencePeer[]>(`/api/presence?worldId=${encodeURIComponent(worldId)}${roomId ? `&roomId=${encodeURIComponent(roomId)}` : ""}`),
  createRoom: (worldId: string, world?: World) => call<{ roomId: string }>("/api/rooms", { method: "POST", body: world ? { worldId, world } : { worldId }, auth: true }),
  raceRoom: (roomId: string) =>
    call<{ room: { id: string; worldId: string; host: string; createdAt: string }; board: BoardEntry[]; world?: World }>(`/api/rooms/${encodeURIComponent(roomId)}`),
  raceProgress: (roomId: string, missions: number, clues: number, finished: boolean) =>
    call<{ ok: boolean }>(`/api/rooms/${encodeURIComponent(roomId)}/progress`, { method: "POST", body: { missions, clues, finished }, auth: true }),
};
