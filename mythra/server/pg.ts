// Mythio backend store — Postgres (Neon serverless, fetch-based: no pooled
// connections, safe for Vercel serverless). Same `Store` contract as SQLite;
// JSON blobs stay TEXT for 1:1 parity. Used when DATABASE_URL is set.
import { neon } from "@neondatabase/serverless";
import { rank } from "./store.js";
import type { PresenceRow, RaceRow, Store } from "./store.js";

type SqlRow = Record<string, unknown>;
export type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<SqlRow[]>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tokens_email ON tokens(email);
CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS progress (
  email TEXT NOT NULL,
  world_id TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (email, world_id)
);
CREATE TABLE IF NOT EXISTS board (
  world_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  missions INTEGER NOT NULL DEFAULT 0,
  clues INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (world_id, user_name)
);
CREATE INDEX IF NOT EXISTS idx_board_world ON board(world_id, missions DESC, clues DESC);
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  host TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS room_worlds (
  room_id TEXT PRIMARY KEY,
  world TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS library (
  owner TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS checkpoints (
  owner TEXT NOT NULL,
  world_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (owner, world_id)
);
CREATE TABLE IF NOT EXISTS racers (
  room_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  missions INTEGER NOT NULL DEFAULT 0,
  clues INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  finished_at TEXT,
  PRIMARY KEY (room_id, user_name)
);
CREATE TABLE IF NOT EXISTS presence (
  world_id TEXT NOT NULL,
  email TEXT NOT NULL,
  pos TEXT NOT NULL,
  suit TEXT NOT NULL DEFAULT '',
  room TEXT NOT NULL DEFAULT '',
  ts BIGINT NOT NULL,
  PRIMARY KEY (world_id, email)
);
CREATE INDEX IF NOT EXISTS idx_presence_ts ON presence(world_id, ts);
CREATE TABLE IF NOT EXISTS discord_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  global_name TEXT,
  avatar TEXT,
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS oauth_state (
  state TEXT PRIMARY KEY,
  created_at BIGINT NOT NULL
);
`;

/** Create all tables (idempotent). Await once per cold start. */
export async function ensurePgSchema(sql: SqlTag): Promise<void> {
  const query = (sql as unknown as { query?: (text: string) => Promise<unknown> }).query;
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    if (query) await query(`${stmt};`);
    else await sql([`${stmt};`] as unknown as TemplateStringsArray);
  }
}

function parseJson<T>(value: unknown): T | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));
const str = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));

export function createPgStore(sqlTag?: SqlTag): Store {
  const sql: SqlTag = sqlTag ?? (neon(process.env.DATABASE_URL ?? "") as unknown as SqlTag);
  return {
    async setCode(email, code, expiresAt): Promise<void> {
      await sql`INSERT INTO codes (email, code, expires_at) VALUES (${email}, ${code}, ${expiresAt}) ON CONFLICT(email) DO UPDATE SET code=EXCLUDED.code, expires_at=EXCLUDED.expires_at`;
    },
    async getCode(email): Promise<{ code: string; expiresAt: number } | undefined> {
      const rows = await sql`SELECT code, expires_at AS "expiresAt" FROM codes WHERE email = ${email}`;
      const r = rows[0];
      return r ? { code: str(r.code), expiresAt: num(r.expiresAt) } : undefined;
    },
    async delCode(email): Promise<void> {
      await sql`DELETE FROM codes WHERE email = ${email}`;
    },

    async addToken(token, email): Promise<void> {
      await sql`INSERT INTO tokens (token, email) VALUES (${token}, ${email}) ON CONFLICT DO NOTHING`;
    },
    async emailForToken(token): Promise<string | null> {
      const rows = await sql`SELECT email FROM tokens WHERE token = ${token}`;
      return rows[0] ? str(rows[0].email) : null;
    },

    async putWorld(id, data, owner): Promise<void> {
      await sql`INSERT INTO worlds (id, data, owner, updated_at) VALUES (${id}, ${JSON.stringify(data)}, ${owner}, ${new Date().toISOString()}) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, owner=EXCLUDED.owner, updated_at=EXCLUDED.updated_at`;
    },
    async listWorlds(): Promise<{ id: string; data: unknown; owner: string }[]> {
      const rows = await sql`SELECT id, data, owner FROM worlds`;
      const out: { id: string; data: unknown; owner: string }[] = [];
      for (const r of rows) {
        const data = parseJson<unknown>(r.data);
        if (data !== undefined) out.push({ id: str(r.id), data, owner: str(r.owner) });
      }
      return out;
    },
    async getWorld(id): Promise<unknown | undefined> {
      const rows = await sql`SELECT data FROM worlds WHERE id = ${id}`;
      return rows[0] ? parseJson<unknown>(rows[0].data) : undefined;
    },

    async putProgress(email, worldId, snapshot): Promise<void> {
      await sql`INSERT INTO progress (email, world_id, snapshot, updated_at) VALUES (${email}, ${worldId}, ${JSON.stringify(snapshot)}, ${new Date().toISOString()}) ON CONFLICT(email, world_id) DO UPDATE SET snapshot=EXCLUDED.snapshot, updated_at=EXCLUDED.updated_at`;
    },
    async getProgress(email, worldId): Promise<unknown | undefined> {
      const rows = await sql`SELECT snapshot FROM progress WHERE email = ${email} AND world_id = ${worldId}`;
      return rows[0] ? parseJson<unknown>(rows[0].snapshot) : undefined;
    },

    async upsertScore(worldId, user, missions, clues): Promise<{ missions: number; clues: number; updatedAt: string }> {
      const prev = await sql`SELECT missions, clues FROM board WHERE world_id = ${worldId} AND user_name = ${user}`;
      const p = prev[0];
      const keep = p && (num(p.missions) > missions || (num(p.missions) === missions && num(p.clues) >= clues));
      const now = new Date().toISOString();
      const row = keep
        ? { missions: num(p.missions), clues: num(p.clues), updatedAt: now }
        : { missions, clues, updatedAt: now };
      await sql`INSERT INTO board (world_id, user_name, missions, clues, updated_at) VALUES (${worldId}, ${user}, ${row.missions}, ${row.clues}, ${row.updatedAt}) ON CONFLICT(world_id, user_name) DO UPDATE SET missions=EXCLUDED.missions, clues=EXCLUDED.clues, updated_at=EXCLUDED.updated_at`;
      return row;
    },
    async boardFor(worldId): Promise<RaceRow[]> {
      const rows = await sql`SELECT user_name AS "user", missions, clues, updated_at AS "updatedAt" FROM board WHERE world_id = ${worldId}`;
      return rank(rows.map((r) => ({ user: str(r.user), worldId, missions: num(r.missions), clues: num(r.clues), updatedAt: str(r.updatedAt), startedAt: str(r.updatedAt) })));
    },
    async allBoards(): Promise<Record<string, RaceRow[]>> {
      const rows = await sql`SELECT world_id AS "worldId", user_name AS "user", missions, clues, updated_at AS "updatedAt" FROM board`;
      const out: Record<string, RaceRow[]> = {};
      for (const r of rows) {
        const worldId = str(r.worldId);
        (out[worldId] ??= []).push({ user: str(r.user), worldId, missions: num(r.missions), clues: num(r.clues), updatedAt: str(r.updatedAt), startedAt: str(r.updatedAt) });
      }
      for (const k of Object.keys(out)) out[k] = rank(out[k]);
      return out;
    },

    async putRoom(id, worldId, host): Promise<void> {
      await sql`INSERT INTO rooms (id, world_id, host, created_at) VALUES (${id}, ${worldId}, ${host}, ${new Date().toISOString()}) ON CONFLICT DO NOTHING`;
    },
    async getRoom(id): Promise<{ id: string; worldId: string; host: string; createdAt: string } | undefined> {
      const rows = await sql`SELECT id, world_id AS "worldId", host, created_at AS "createdAt" FROM rooms WHERE id = ${id}`;
      const r = rows[0];
      return r ? { id: str(r.id), worldId: str(r.worldId), host: str(r.host), createdAt: str(r.createdAt) } : undefined;
    },
    async putRoomWorld(roomId, world): Promise<void> {
      await sql`INSERT INTO room_worlds (room_id, world, updated_at) VALUES (${roomId}, ${JSON.stringify(world)}, ${new Date().toISOString()}) ON CONFLICT(room_id) DO UPDATE SET world=EXCLUDED.world, updated_at=EXCLUDED.updated_at`;
    },
    async getRoomWorld(roomId): Promise<unknown | undefined> {
      const rows = await sql`SELECT world FROM room_worlds WHERE room_id = ${roomId}`;
      return rows[0] ? parseJson<unknown>(rows[0].world) : undefined;
    },
    async putRacer(roomId, user, missions, clues, finished): Promise<void> {
      const prev = await sql`SELECT started_at AS "startedAt" FROM racers WHERE room_id = ${roomId} AND user_name = ${user}`;
      const now = new Date().toISOString();
      await sql`INSERT INTO racers (room_id, user_name, missions, clues, started_at, updated_at, finished_at) VALUES (${roomId}, ${user}, ${missions}, ${clues}, ${prev[0] ? str(prev[0].startedAt) : now}, ${now}, ${finished ? now : null}) ON CONFLICT(room_id, user_name) DO UPDATE SET missions=EXCLUDED.missions, clues=EXCLUDED.clues, updated_at=EXCLUDED.updated_at, finished_at=EXCLUDED.finished_at`;
    },
    async racersFor(roomId, worldId): Promise<RaceRow[]> {
      const rows = await sql`SELECT user_name AS "user", missions, clues, started_at AS "startedAt", updated_at AS "updatedAt", finished_at AS "finishedAt" FROM racers WHERE room_id = ${roomId}`;
      return rank(rows.map((r) => ({
        user: str(r.user), worldId, missions: num(r.missions), clues: num(r.clues),
        startedAt: str(r.startedAt), updatedAt: str(r.updatedAt),
        ...(r.finishedAt ? { finishedAt: str(r.finishedAt) } : {}),
      })));
    },

    async heartbeat(worldId, email, pos, suit, room): Promise<void> {
      await sql`INSERT INTO presence (world_id, email, pos, suit, room, ts) VALUES (${worldId}, ${email}, ${JSON.stringify(pos)}, ${suit}, ${room}, ${Date.now()}) ON CONFLICT(world_id, email) DO UPDATE SET pos=EXCLUDED.pos, suit=EXCLUDED.suit, room=EXCLUDED.room, ts=EXCLUDED.ts`;
    },
    async peersFor(worldId, roomId, windowMs): Promise<PresenceRow[]> {
      const cutoff = Date.now() - windowMs;
      await sql`DELETE FROM presence WHERE ts < ${cutoff}`;
      const rows = await sql`SELECT email, pos, suit, room FROM presence WHERE world_id = ${worldId}`;
      const out: PresenceRow[] = [];
      for (const r of rows) {
        if (roomId && str(r.room) !== roomId) continue;
        let pos: [number, number, number] = [0, 1.7, 6];
        try {
          const p = JSON.parse(str(r.pos)) as [number, number, number];
          if (Array.isArray(p) && p.length === 3) pos = p;
        } catch {
          /* keep default */
        }
        out.push({ user: str(r.email).split("@")[0], pos, suit: str(r.suit), room: str(r.room) });
      }
      return out;
    },

    async putLibrary(owner, data): Promise<string> {
      const now = new Date().toISOString();
      await sql`INSERT INTO library (owner, data, updated_at) VALUES (${owner}, ${JSON.stringify(data)}, ${now}) ON CONFLICT(owner) DO UPDATE SET data=EXCLUDED.data, updated_at=EXCLUDED.updated_at`;
      return now;
    },
    async getLibrary(owner): Promise<{ data: unknown; updatedAt: string } | undefined> {
      const rows = await sql`SELECT data, updated_at AS "updatedAt" FROM library WHERE owner = ${owner}`;
      const r = rows[0];
      if (!r) return undefined;
      const data = parseJson<unknown>(r.data);
      return data === undefined ? undefined : { data, updatedAt: str(r.updatedAt) };
    },

    async putCheckpoints(owner, worldId, list): Promise<string> {
      const now = new Date().toISOString();
      await sql`INSERT INTO checkpoints (owner, world_id, data, updated_at) VALUES (${owner}, ${worldId}, ${JSON.stringify(list)}, ${now}) ON CONFLICT(owner, world_id) DO UPDATE SET data=EXCLUDED.data, updated_at=EXCLUDED.updated_at`;
      return now;
    },
    async getCheckpoints(owner, worldId): Promise<{ data: unknown; updatedAt: string } | undefined> {
      const rows = await sql`SELECT data, updated_at AS "updatedAt" FROM checkpoints WHERE owner = ${owner} AND world_id = ${worldId}`;
      const r = rows[0];
      if (!r) return undefined;
      const data = parseJson<unknown>(r.data);
      return data === undefined ? undefined : { data, updatedAt: str(r.updatedAt) };
    },

    async upsertDiscordUser(id, username, globalName, avatar): Promise<void> {
      await sql`INSERT INTO discord_users (id, username, global_name, avatar, updated_at) VALUES (${id}, ${username}, ${globalName}, ${avatar}, ${new Date().toISOString()}) ON CONFLICT(id) DO UPDATE SET username=EXCLUDED.username, global_name=EXCLUDED.global_name, avatar=EXCLUDED.avatar, updated_at=EXCLUDED.updated_at`;
    },
    async saveState(state): Promise<void> {
      await sql`DELETE FROM oauth_state WHERE created_at < ${Date.now() - 10 * 60 * 1000}`;
      await sql`INSERT INTO oauth_state (state, created_at) VALUES (${state}, ${Date.now()})`;
    },
    async consumeState(state): Promise<boolean> {
      const rows = await sql`SELECT state FROM oauth_state WHERE state = ${state}`;
      if (!rows[0]) return false;
      await sql`DELETE FROM oauth_state WHERE state = ${state}`;
      return true;
    },
  };
}
