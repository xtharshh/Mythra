// Mythio API app — Fastify backend for worlds, progress, leaderboard, presence.
// The store behind it is SQLite locally, Postgres (Neon) when DATABASE_URL is
// set (Vercel). See server/index.ts (listen) and api/[...all].ts (serverless).
import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { store } from "./db.js";
import { buildAdminStats, isAdminEmail } from "./admin.js";
import { avatarUrl, discordAuthUrl, discordConfigured, discordEnv, displayName, exchangeCode, fetchProfile, newState } from "./discord.js";
import { worldSchema } from "../src/schemas.js";
import { validateWorld } from "../src/game/engines.js";
import { createRateLimiter } from "./ratelimit.js";

// Vite loads mythra/.env automatically for the web client, but this Fastify
// process does not — so load it here (zero deps). Without this,
// DISCORD_CLIENT_ID/SECRET stay empty and /api/auth/discord 400s with
// "Discord login isn't configured on this server".
function loadDotEnv(): void {
  // 1) Node ≥21.7 / 22 built-in loader (respects cwd, i.e. mythra/ via npm run dev:api).
  try {
    const proc = process as unknown as { loadEnvFile?: (path?: string) => void };
    if (typeof proc.loadEnvFile === "function") {
      try {
        proc.loadEnvFile();
      } catch {
        /* no .env at cwd — fall through to manual lookup below */
      }
      if (process.env.DISCORD_CLIENT_ID) return;
    }
  } catch {
    /* ignore, use manual parser */
  }
  // 2) Minimal manual parser: check cwd/.env then server/../.env. Never
  //    overwrites real environment variables (hosting providers inject those).
  const candidates = [
    join(process.cwd(), ".env"),
    join(dirname(fileURLToPath(import.meta.url)), "..", ".env"),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    let text = "";
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1);
      }
      if (key && !(key in process.env)) process.env[key] = value;
    }
    if (process.env.DISCORD_CLIENT_ID) return;
  }
}
loadDotEnv();

const usingPostgres = !!process.env.DATABASE_URL;
let schemaError: string | null = null;
if (usingPostgres) {
  try {
    const { neon } = await import("@neondatabase/serverless");
    const { ensurePgSchema } = await import("./pg.js");
    await ensurePgSchema(neon(process.env.DATABASE_URL ?? "") as never);
  } catch (e) {
    schemaError = e instanceof Error ? e.message : "Postgres schema failed";
    console.error(`Database schema error: ${schemaError}`);
  }
}

const migrated = usingPostgres
  ? []
  : await (await import("./sqlite.js")).migrateFromJson(store);
if (migrated.length > 0) console.log(`Migrated legacy tables: ${migrated.join(", ")}`);

const app = Fastify({ logger: false, trustProxy: true });

// CORS: the configured frontend + local dev only — never the whole internet.
// Set FRONTEND_URL=https://your-game.pages.dev in production.
const frontendOrigin = (process.env.FRONTEND_URL ?? "http://localhost:5173").replace(/\/$/, "");
await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin / curl / health checks
    try {
      const host = new URL(origin).origin;
      if (host === frontendOrigin || host === "http://localhost:5173" || host === "http://localhost:4173" || host === "http://127.0.0.1:5173") {
        return cb(null, true);
      }
    } catch {
      /* fall through to refusal */
    }
    return cb(null, false);
  },
});

// abuse protection: generous global lane + strict lane for auth endpoints
const globalLane = createRateLimiter({ windowMs: 60 * 1000, max: 600 });
const authLane = createRateLimiter({ windowMs: 60 * 1000, max: 60 });
app.addHook("onRequest", async (req, reply) => {
  const ip = req.ip || req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || "unknown";
  const lane = req.url.startsWith("/api/auth/") || req.url.startsWith("/api/admin/") ? authLane : globalLane;
  if (!lane.check(ip)) {
    return reply.code(429).send({ error: "Too many requests — slow down for a minute." });
  }
});

const emailOk = (e: unknown): e is string =>
  typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim().toLowerCase());

const emailOf = async (req: { headers: Record<string, string | string[] | undefined> }): Promise<string | null> => {
  const h = req.headers.authorization;
  const token = typeof h === "string" && h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return null;
  return store.emailForToken(token);
};

app.get("/health", async () => ({
  ok: !schemaError,
  service: "mythio-api",
  store: usingPostgres ? "postgres" : "sqlite",
  discord: discordConfigured(),
  ...(schemaError ? { dbError: schemaError } : {}),
}));
app.get("/ready", async () => ({ ok: true }));

// --- Sign in with Discord (OAuth2; secret stays server-side) ---
app.get("/api/auth/discord", async (_req, reply) => {
  if (!discordConfigured()) {
    return reply.code(400).send({ error: "Discord login isn't configured on this server (DISCORD_CLIENT_ID/SECRET)." });
  }
  const state = newState();
  await store.saveState(state);
  return reply.redirect(discordAuthUrl(state));
});

app.get("/api/auth/discord/callback", async (req, reply) => {
  const { code, state, error } = (req.query ?? {}) as { code?: string; state?: string; error?: string };
  const frontend = discordEnv().frontendUrl;
  const fail = (msg: string) => reply.redirect(`${frontend}/?authError=${encodeURIComponent(msg)}`);
  if (error) return fail(`Discord said no (${error}).`);
  if (!code || !state || !(await store.consumeState(state))) return fail("Bad or expired login attempt — try again.");
  try {
    const { accessToken } = await exchangeCode(code);
    const profile = await fetchProfile(accessToken);
    await store.upsertDiscordUser(profile.id, profile.username, profile.globalName, profile.avatar);
    const name = displayName(profile);
    const token = randomBytes(24).toString("hex");
    await store.addToken(token, name);
    const avatar = avatarUrl(profile);
    return reply.redirect(
      `${frontend}/?session=${encodeURIComponent(token)}&user=${encodeURIComponent(name)}&did=${encodeURIComponent(profile.id)}&uname=${encodeURIComponent(profile.username)}${avatar ? `&avatar=${encodeURIComponent(avatar)}` : ""}`,
    );
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Discord login failed.");
  }
});

// --- email code login (demo: code returned; plug a mailer later) ---
app.post("/api/auth/code", async (req, reply) => {
  const { email } = (req.body ?? {}) as { email?: unknown };
  if (!emailOk(email)) return reply.code(400).send({ error: "Enter a valid email address." });
  const clean = email.trim().toLowerCase();
  const code = String(100000 + Math.floor(Math.random() * 900000));
  await store.setCode(clean, code, Date.now() + 10 * 60 * 1000);
  return { email: clean, code, demo: true };
});

app.post("/api/auth/verify", async (req, reply) => {
  const { email, code } = (req.body ?? {}) as { email?: unknown; code?: unknown };
  if (!emailOk(email)) return reply.code(400).send({ error: "Enter a valid email address." });
  const clean = (email as string).trim().toLowerCase();
  const pending = await store.getCode(clean);
  if (!pending) return reply.code(400).send({ error: "No code requested for this email." });
  if (pending.expiresAt <= Date.now()) return reply.code(400).send({ error: "Code expired." });
  if (pending.code !== String(code ?? "").trim()) return reply.code(400).send({ error: "Wrong code." });
  const token = randomBytes(24).toString("hex");
  await store.addToken(token, clean);
  await store.delCode(clean);
  return { token, email: clean };
});

// --- worlds: publish + discover (published visible to every solver) ---
app.get("/api/worlds", async () => {
  const boards = await store.allBoards();
  return (await store.listWorlds()).map(({ id, data, owner }) => {
    const entries = boards[id] ?? [];
    return {
      ...(data as object),
      plays: entries.length,
      solvers: [...new Set(entries.map((e) => e.user))].length,
      ownerId: owner || (data as { ownerId?: string }).ownerId,
    };
  });
});

app.post("/api/worlds", async (req, reply) => {
  const email = await emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const parsed = worldSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid world." });
  // approval gate: everything the tale needs must check out before it shows
  // to every solver — broken worlds never reach the Archive
  const report = validateWorld(parsed.data as Parameters<typeof validateWorld>[0]);
  if (!report.valid) {
    return reply.code(400).send({ error: `Tale rejected: ${report.errors.slice(0, 3).map((e) => e.message).join(" | ")}` });
  }
  const world = { ...(parsed.data as object), status: "published" } as Record<string, unknown>;
  await store.putWorld(world.id as string, world, email);
  return { ok: true, id: world.id };
});

app.get("/api/worlds/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const world = await store.getWorld(id);
  if (!world) return reply.code(404).send({ error: "Unknown world." });
  return world;
});

// --- progress cloud saves (per explorer + world) ---
app.post("/api/progress", async (req, reply) => {
  const email = await emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { worldId, snapshot } = (req.body ?? {}) as { worldId?: unknown; snapshot?: unknown };
  if (typeof worldId !== "string" || !snapshot || typeof snapshot !== "object") {
    return reply.code(400).send({ error: "worldId + snapshot required." });
  }
  await store.putProgress(email, worldId, snapshot);
  return { ok: true };
});

app.get("/api/progress/:worldId", async (req, reply) => {
  const email = await emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { worldId } = req.params as { worldId: string };
  return (await store.getProgress(email, worldId)) ?? null;
});

// --- library cloud sync (per explorer; last write wins by updatedAt) ---
app.get("/api/library", async (req, reply) => {
  const email = await emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  return (await store.getLibrary(email)) ?? null;
});

app.put("/api/library", async (req, reply) => {
  const email = await emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { data } = (req.body ?? {}) as { data?: unknown };
  if (!data || typeof data !== "object") return reply.code(400).send({ error: "data required." });
  return { ok: true, updatedAt: await store.putLibrary(email, data) };
});

// --- checkpoints cloud sync (per explorer + world; clients union by id) ---
app.get("/api/checkpoints/:worldId", async (req, reply) => {
  const email = await emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { worldId } = req.params as { worldId: string };
  return (await store.getCheckpoints(email, worldId)) ?? null;
});

app.put("/api/checkpoints/:worldId", async (req, reply) => {
  const email = await emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { worldId } = req.params as { worldId: string };
  const { checkpoints } = (req.body ?? {}) as { checkpoints?: unknown };
  if (!Array.isArray(checkpoints)) return reply.code(400).send({ error: "checkpoints array required." });
  return { ok: true, updatedAt: await store.putCheckpoints(email, worldId, checkpoints) };
});

// --- leaderboard: best run per explorer per world ---
app.post("/api/leaderboard", async (req, reply) => {
  const email = await emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { worldId, missions, clues } = (req.body ?? {}) as { worldId?: unknown; missions?: unknown; clues?: unknown };
  if (typeof worldId !== "string") return reply.code(400).send({ error: "worldId required." });
  const user = email.split("@")[0];
  const row = await store.upsertScore(worldId, user, typeof missions === "number" ? missions : 0, typeof clues === "number" ? clues : 0);
  return { ok: true, entry: { user, worldId, ...row } };
});

app.get("/api/leaderboard", async (req) => {
  const { worldId } = (req.query ?? {}) as { worldId?: string };
  if (worldId) return store.boardFor(worldId);
  return store.allBoards();
});

// --- presence: who is inside each story right now (15s window) ---
const WINDOW_MS = 15 * 1000;

app.post("/api/presence", async (req, reply) => {
  const email = await emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { worldId, pos, suit, roomId } = (req.body ?? {}) as { worldId?: unknown; pos?: unknown; suit?: unknown; roomId?: unknown };
  if (typeof worldId !== "string" || !Array.isArray(pos)) return reply.code(400).send({ error: "worldId + pos required." });
  await store.heartbeat(worldId, email, pos as [number, number, number], typeof suit === "string" ? suit : "explorer", typeof roomId === "string" ? roomId : "");
  return { ok: true };
});

app.get("/api/presence", async (req) => {
  const { worldId, roomId } = (req.query ?? {}) as { worldId?: string; roomId?: string };
  if (!worldId) return [];
  return store.peersFor(worldId, roomId ?? "", WINDOW_MS);
});

// --- race rooms: invite links, speed boards, shared solves ---
// POST accepts an optional full `world` snapshot so short invite links work
// without publishing the tale to the Archive first.
const MAX_ROOM_WORLD_BYTES = 2 * 1024 * 1024;
app.post("/api/rooms", async (req, reply) => {
  const email = await emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { worldId, world } = (req.body ?? {}) as { worldId?: unknown; world?: unknown };
  if (typeof worldId !== "string") return reply.code(400).send({ error: "worldId required." });
  const id = randomBytes(3).toString("hex");
  await store.putRoom(id, worldId, email.split("@")[0]);
  if (world !== undefined) {
    if (!world || typeof world !== "object" || typeof (world as { id?: unknown }).id !== "string") {
      return reply.code(400).send({ error: "world snapshot needs a string id." });
    }
    let bytes = 0;
    try {
      bytes = JSON.stringify(world).length;
    } catch {
      return reply.code(400).send({ error: "world snapshot isn't JSON." });
    }
    if (bytes > MAX_ROOM_WORLD_BYTES) return reply.code(413).send({ error: "Tale too big for a short link — use the full link instead." });
    await store.putRoomWorld(id, world);
  }
  return { roomId: id };
});

app.get("/api/rooms/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const room = await store.getRoom(id);
  if (!room) return reply.code(404).send({ error: "Unknown race room." });
  const world = await store.getRoomWorld(id);
  const board = await store.racersFor(id, room.worldId);
  return world === undefined ? { room, board } : { room, board, world };
});

app.post("/api/rooms/:id/progress", async (req, reply) => {
  const email = await emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { id } = req.params as { id: string };
  if (!(await store.getRoom(id))) return reply.code(404).send({ error: "Unknown race room." });
  const { missions, clues, finished } = (req.body ?? {}) as { missions?: unknown; clues?: unknown; finished?: unknown };
  await store.putRacer(
    id,
    email.split("@")[0],
    typeof missions === "number" ? missions : 0,
    typeof clues === "number" ? clues : 0,
    finished === true,
  );
  return { ok: true };
});

// --- admin: allowlisted login + analytics dashboard data ---
// ADMIN_EMAILS (comma-separated) + ADMIN_KEY live in server env. With either
// unset, every admin call fails closed — there is no backdoor.
app.post("/api/admin/login", async (req, reply) => {
  const { email, key } = (req.body ?? {}) as { email?: unknown; key?: unknown };
  if (!emailOk(email)) return reply.code(400).send({ error: "Enter a valid email address." });
  const clean = (email as string).trim().toLowerCase();
  if (!isAdminEmail(clean) || typeof key !== "string" || !key || key !== process.env.ADMIN_KEY) {
    return reply.code(401).send({ error: "Not an admin login — check the email and key." });
  }
  const token = randomBytes(24).toString("hex");
  await store.addToken(token, clean);
  return { token, email: clean };
});

app.get("/api/admin/stats", async (req, reply) => {
  const email = await emailOf(req);
  if (!email || !isAdminEmail(email)) return reply.code(403).send({ error: "Admin only." });
  const [worlds, boards] = await Promise.all([store.listWorlds(), store.allBoards()]);
  return buildAdminStats(worlds, boards);
});

export default app;
