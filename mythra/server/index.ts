// MYTHRA API — Fastify backend for worlds, progress, leaderboard, presence.
// Run: `npm run dev:api` (PORT, default 4000). File-backed store; Postgres later.
// The web client uses it when VITE_API_URL is set, else plays fully local.
import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomBytes } from "node:crypto";
import { read, write } from "./db.js";
import { worldSchema } from "../src/schemas.js";

const app = Fastify({ logger: false });
await app.register(cors, { origin: true });

const emailOk = (e: unknown): e is string =>
  typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim().toLowerCase());

const emailOf = (req: { headers: Record<string, string | string[] | undefined> }): string | null => {
  const h = req.headers.authorization;
  const token = typeof h === "string" && h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return null;
  return read("tokens")[token] ?? null;
};

app.get("/health", async () => ({ ok: true, service: "mythra-api" }));
app.get("/ready", async () => ({ ok: true }));

// --- email code login (demo: code returned; plug a mailer later) ---
app.post("/api/auth/code", async (req, reply) => {
  const { email } = (req.body ?? {}) as { email?: unknown };
  if (!emailOk(email)) return reply.code(400).send({ error: "Enter a valid email address." });
  const clean = email.trim().toLowerCase();
  const code = String(100000 + Math.floor(Math.random() * 900000));
  const codes = read("codes");
  codes[clean] = { code, expiresAt: Date.now() + 10 * 60 * 1000 };
  write("codes", codes);
  return { email: clean, code, demo: true };
});

app.post("/api/auth/verify", async (req, reply) => {
  const { email, code } = (req.body ?? {}) as { email?: unknown; code?: unknown };
  if (!emailOk(email)) return reply.code(400).send({ error: "Enter a valid email address." });
  const clean = (email as string).trim().toLowerCase();
  const pending = read("codes")[clean];
  if (!pending) return reply.code(400).send({ error: "No code requested for this email." });
  if (pending.expiresAt <= Date.now()) return reply.code(400).send({ error: "Code expired." });
  if (pending.code !== String(code ?? "").trim()) return reply.code(400).send({ error: "Wrong code." });
  const token = randomBytes(24).toString("hex");
  const tokens = read("tokens");
  tokens[token] = clean;
  write("tokens", tokens);
  const codes = read("codes");
  delete codes[clean];
  write("codes", codes);
  return { token, email: clean };
});

// --- worlds: publish + discover (published visible to every solver) ---
app.get("/api/worlds", async () => {
  const worlds = Object.values(read("worlds")) as Record<string, unknown>[];
  const board = read("board");
  return worlds.map((w) => {
    const r = w as { id: string; missions?: unknown[]; clues?: unknown[]; puzzles?: unknown[] };
    const entries = Object.values(board).flat().filter((e) => e.worldId === r.id);
    return {
      ...(r as object),
      plays: entries.length,
      solvers: [...new Set(entries.map((e) => e.user))].length,
    };
  });
});

app.post("/api/worlds", async (req, reply) => {
  const email = emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const parsed = worldSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid world." });
  const world = { ...(parsed.data as object), status: "published" } as Record<string, unknown>;
  const worlds = read("worlds");
  worlds[world.id as string] = world;
  write("worlds", worlds);
  return { ok: true, id: world.id };
});

app.get("/api/worlds/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const world = read("worlds")[id];
  if (!world) return reply.code(404).send({ error: "Unknown world." });
  return world;
});

// --- progress cloud saves (per explorer + world) ---
app.post("/api/progress", async (req, reply) => {
  const email = emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { worldId, snapshot } = (req.body ?? {}) as { worldId?: unknown; snapshot?: unknown };
  if (typeof worldId !== "string" || !snapshot || typeof snapshot !== "object") {
    return reply.code(400).send({ error: "worldId + snapshot required." });
  }
  const progress = read("progress");
  progress[`${email}:${worldId}`] = snapshot;
  write("progress", progress);
  return { ok: true };
});

app.get("/api/progress/:worldId", async (req, reply) => {
  const email = emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { worldId } = req.params as { worldId: string };
  return read("progress")[`${email}:${worldId}`] ?? null;
});

// --- leaderboard: best run per explorer per world ---
app.post("/api/leaderboard", async (req, reply) => {
  const email = emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { worldId, missions, clues } = (req.body ?? {}) as { worldId?: unknown; missions?: unknown; clues?: unknown };
  if (typeof worldId !== "string") return reply.code(400).send({ error: "worldId required." });
  const board = read("board");
  const list = board[worldId] ?? [];
  const entry = {
    user: email.split("@")[0],
    worldId,
    missions: typeof missions === "number" ? missions : 0,
    clues: typeof clues === "number" ? clues : 0,
    updatedAt: new Date().toISOString(),
  };
  const rest = list.filter((e) => e.user !== entry.user);
  // keep personal best (missions, then clues)
  const prev = list.find((e) => e.user === entry.user);
  const best = prev && (prev.missions > entry.missions || (prev.missions === entry.missions && prev.clues >= entry.clues)) ? prev : entry;
  board[worldId] = [...rest, best].sort((a, b) => b.missions - a.missions || b.clues - a.clues).slice(0, 100);
  write("board", board);
  return { ok: true, entry: best };
});

app.get("/api/leaderboard", async (req) => {
  const { worldId } = (req.query ?? {}) as { worldId?: string };
  const board = read("board");
  if (worldId) return board[worldId] ?? [];
  return board;
});

// --- presence: who is inside each story right now (15s window) ---
const WINDOW_MS = 15 * 1000;

app.post("/api/presence", async (req, reply) => {
  const email = emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { worldId, pos, suit } = (req.body ?? {}) as { worldId?: unknown; pos?: unknown; suit?: unknown };
  if (typeof worldId !== "string" || !Array.isArray(pos)) return reply.code(400).send({ error: "worldId + pos required." });
  const presence = read("presence");
  const room = presence[worldId] ?? {};
  room[email] = { pos: pos as [number, number, number], suit: typeof suit === "string" ? suit : "explorer", ts: Date.now() };
  for (const [u, p] of Object.entries(room)) {
    if (Date.now() - (p as { ts: number }).ts > WINDOW_MS) delete room[u];
  }
  presence[worldId] = room;
  write("presence", presence);
  return { ok: true };
});

app.get("/api/presence", async (req) => {
  const { worldId } = (req.query ?? {}) as { worldId?: string };
  if (!worldId) return [];
  const room = read("presence")[worldId] ?? {};
  const now = Date.now();
  return Object.entries(room)
    .filter(([, p]) => now - (p as { ts: number }).ts <= WINDOW_MS)
    .map(([email, p]) => ({ user: (email as string).split("@")[0], ...(p as object) }));
});

const port = Number(process.env.PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`MYTHRA API on :${port}`);
});
