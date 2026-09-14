// MYTHRA API — Fastify backend for worlds, progress, leaderboard, presence.
// Run: `npm run dev:api` (PORT, default 4000). SQLite store (zero deps,
// server/.data/mythra.db, gitignored; legacy JSON auto-migrates on boot).
// The web client uses it when VITE_API_URL is set, else plays fully local.
import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomBytes } from "node:crypto";
import { migrateFromJson, store } from "./db.js";
import { avatarUrl, discordAuthUrl, discordConfigured, discordEnv, displayName, exchangeCode, fetchProfile, newState } from "./discord.js";
import { worldSchema } from "../src/schemas.js";

const migrated = migrateFromJson();
if (migrated.length > 0) console.log(`Migrated legacy tables: ${migrated.join(", ")}`);

const app = Fastify({ logger: false });
await app.register(cors, { origin: true });

const emailOk = (e: unknown): e is string =>
  typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim().toLowerCase());

const emailOf = (req: { headers: Record<string, string | string[] | undefined> }): string | null => {
  const h = req.headers.authorization;
  const token = typeof h === "string" && h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return null;
  return store.emailForToken(token);
};

app.get("/health", async () => ({ ok: true, service: "mythra-api", store: "sqlite", discord: discordConfigured() }));
app.get("/ready", async () => ({ ok: true }));

// --- Sign in with Discord (OAuth2; secret stays server-side) ---
app.get("/api/auth/discord", async (_req, reply) => {
  if (!discordConfigured()) {
    return reply.code(400).send({ error: "Discord login isn't configured on this server (DISCORD_CLIENT_ID/SECRET)." });
  }
  const state = newState();
  store.saveState(state);
  return reply.redirect(discordAuthUrl(state));
});

app.get("/api/auth/discord/callback", async (req, reply) => {
  const { code, state, error } = (req.query ?? {}) as { code?: string; state?: string; error?: string };
  const frontend = discordEnv().frontendUrl;
  const fail = (msg: string) => reply.redirect(`${frontend}/?authError=${encodeURIComponent(msg)}`);
  if (error) return fail(`Discord said no (${error}).`);
  if (!code || !state || !store.consumeState(state)) return fail("Bad or expired login attempt — try again.");
  try {
    const { accessToken } = await exchangeCode(code);
    const profile = await fetchProfile(accessToken);
    store.upsertDiscordUser(profile.id, profile.username, profile.globalName, profile.avatar);
    const name = displayName(profile);
    const token = randomBytes(24).toString("hex");
    store.addToken(token, name);
    const avatar = avatarUrl(profile);
    return reply.redirect(
      `${frontend}/?session=${encodeURIComponent(token)}&user=${encodeURIComponent(name)}${avatar ? `&avatar=${encodeURIComponent(avatar)}` : ""}`,
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
  store.setCode(clean, code, Date.now() + 10 * 60 * 1000);
  return { email: clean, code, demo: true };
});

app.post("/api/auth/verify", async (req, reply) => {
  const { email, code } = (req.body ?? {}) as { email?: unknown; code?: unknown };
  if (!emailOk(email)) return reply.code(400).send({ error: "Enter a valid email address." });
  const clean = (email as string).trim().toLowerCase();
  const pending = store.getCode(clean);
  if (!pending) return reply.code(400).send({ error: "No code requested for this email." });
  if (pending.expiresAt <= Date.now()) return reply.code(400).send({ error: "Code expired." });
  if (pending.code !== String(code ?? "").trim()) return reply.code(400).send({ error: "Wrong code." });
  const token = randomBytes(24).toString("hex");
  store.addToken(token, clean);
  store.delCode(clean);
  return { token, email: clean };
});

// --- worlds: publish + discover (published visible to every solver) ---
app.get("/api/worlds", async () => {
  const boards = store.allBoards();
  return store.listWorlds().map(({ id, data, owner }) => {
    const w = data as { missions?: unknown[]; clues?: unknown[]; puzzles?: unknown[] };
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
  const email = emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const parsed = worldSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid world." });
  const world = { ...(parsed.data as object), status: "published" } as Record<string, unknown>;
  store.putWorld(world.id as string, world, email);
  return { ok: true, id: world.id };
});

app.get("/api/worlds/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const world = store.getWorld(id);
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
  store.putProgress(email, worldId, snapshot);
  return { ok: true };
});

app.get("/api/progress/:worldId", async (req, reply) => {
  const email = emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { worldId } = req.params as { worldId: string };
  return store.getProgress(email, worldId) ?? null;
});

// --- leaderboard: best run per explorer per world ---
app.post("/api/leaderboard", async (req, reply) => {
  const email = emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { worldId, missions, clues } = (req.body ?? {}) as { worldId?: unknown; missions?: unknown; clues?: unknown };
  if (typeof worldId !== "string") return reply.code(400).send({ error: "worldId required." });
  const user = email.split("@")[0];
  const row = store.upsertScore(worldId, user, typeof missions === "number" ? missions : 0, typeof clues === "number" ? clues : 0);
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
  const email = emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { worldId, pos, suit, roomId } = (req.body ?? {}) as { worldId?: unknown; pos?: unknown; suit?: unknown; roomId?: unknown };
  if (typeof worldId !== "string" || !Array.isArray(pos)) return reply.code(400).send({ error: "worldId + pos required." });
  store.heartbeat(worldId, email, pos as [number, number, number], typeof suit === "string" ? suit : "explorer", typeof roomId === "string" ? roomId : "");
  return { ok: true };
});

app.get("/api/presence", async (req) => {
  const { worldId, roomId } = (req.query ?? {}) as { worldId?: string; roomId?: string };
  if (!worldId) return [];
  return store.peersFor(worldId, roomId ?? "", WINDOW_MS);
});

// --- race rooms: invite links, speed boards, shared solves ---
app.post("/api/rooms", async (req, reply) => {
  const email = emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { worldId } = (req.body ?? {}) as { worldId?: unknown };
  if (typeof worldId !== "string") return reply.code(400).send({ error: "worldId required." });
  const id = randomBytes(3).toString("hex");
  store.putRoom(id, worldId, email.split("@")[0]);
  return { roomId: id };
});

app.get("/api/rooms/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const room = store.getRoom(id);
  if (!room) return reply.code(404).send({ error: "Unknown race room." });
  return { room, board: store.racersFor(id, room.worldId) };
});

app.post("/api/rooms/:id/progress", async (req, reply) => {
  const email = emailOf(req);
  if (!email) return reply.code(401).send({ error: "Sign in first." });
  const { id } = req.params as { id: string };
  if (!store.getRoom(id)) return reply.code(404).send({ error: "Unknown race room." });
  const { missions, clues, finished } = (req.body ?? {}) as { missions?: unknown; clues?: unknown; finished?: unknown };
  store.putRacer(
    id,
    email.split("@")[0],
    typeof missions === "number" ? missions : 0,
    typeof clues === "number" ? clues : 0,
    finished === true,
  );
  return { ok: true };
});

const port = Number(process.env.PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`MYTHRA API on :${port}`);
});
