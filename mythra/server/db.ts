// MYTHRA backend store — SQLite (node:sqlite, zero deps) with proper
// tables + indexes for the important metadata. File lives at
// server/.data/mythra.db (gitignored). First boot migrates any legacy
// server/.data/*.json tables, then archives them to .data/migrated/.
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const dir = join(dirname(fileURLToPath(import.meta.url)), ".data");
mkdirSync(dir, { recursive: true });

const DB_PATH = process.env.MYTHRA_DB ?? join(dir, "mythra.db");
const db = new DatabaseSync(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL
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
  user TEXT NOT NULL,
  missions INTEGER NOT NULL DEFAULT 0,
  clues INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (world_id, user)
);
CREATE INDEX IF NOT EXISTS idx_board_world ON board(world_id, missions DESC, clues DESC);
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  host TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS racers (
  room_id TEXT NOT NULL,
  user TEXT NOT NULL,
  missions INTEGER NOT NULL DEFAULT 0,
  clues INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  finished_at TEXT,
  PRIMARY KEY (room_id, user)
);
CREATE TABLE IF NOT EXISTS presence (
  world_id TEXT NOT NULL,
  email TEXT NOT NULL,
  pos TEXT NOT NULL,
  suit TEXT NOT NULL DEFAULT '',
  room TEXT NOT NULL DEFAULT '',
  ts INTEGER NOT NULL,
  PRIMARY KEY (world_id, email)
);
CREATE INDEX IF NOT EXISTS idx_presence_ts ON presence(world_id, ts);
`);

export interface RaceRow {
  user: string;
  worldId: string;
  missions: number;
  clues: number;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
}

export interface PresenceRow {
  user: string;
  pos: [number, number, number];
  suit: string;
  room: string;
}

function rank(rows: RaceRow[]): RaceRow[] {
  return rows.sort((a, b) => {
    if (b.missions !== a.missions) return b.missions - a.missions;
    if (b.clues !== a.clues) return b.clues - a.clues;
    if (!!a.finishedAt !== !!b.finishedAt) return a.finishedAt ? -1 : 1;
    if (a.finishedAt && b.finishedAt && a.finishedAt !== b.finishedAt) return a.finishedAt < b.finishedAt ? -1 : 1;
    return a.startedAt < b.startedAt ? -1 : 1;
  });
}

export const store = {
  // codes
  setCode(email: string, code: string, expiresAt: number): void {
    db.prepare("INSERT INTO codes (email, code, expires_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET code=excluded.code, expires_at=excluded.expires_at").run(email, code, expiresAt);
  },
  getCode(email: string): { code: string; expiresAt: number } | undefined {
    const row = db.prepare("SELECT code, expires_at AS expiresAt FROM codes WHERE email = ?").get(email) as { code: string; expiresAt: number } | undefined;
    return row;
  },
  delCode(email: string): void {
    db.prepare("DELETE FROM codes WHERE email = ?").run(email);
  },

  // tokens
  addToken(token: string, email: string): void {
    db.prepare("INSERT INTO tokens (token, email) VALUES (?, ?)").run(token, email);
  },
  emailForToken(token: string): string | null {
    const row = db.prepare("SELECT email FROM tokens WHERE token = ?").get(token) as { email: string } | undefined;
    return row?.email ?? null;
  },

  // worlds
  putWorld(id: string, data: unknown, owner: string): void {
    db.prepare("INSERT INTO worlds (id, data, owner, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, owner=excluded.owner, updated_at=excluded.updated_at").run(
      id, JSON.stringify(data), owner, new Date().toISOString(),
    );
  },
  listWorlds(): { id: string; data: unknown; owner: string }[] {
    return db.prepare("SELECT id, data, owner FROM worlds").all() as { id: string; data: unknown; owner: string }[];
  },
  getWorld(id: string): unknown | undefined {
    const row = db.prepare("SELECT data FROM worlds WHERE id = ?").get(id) as { data: string } | undefined;
    if (!row) return undefined;
    try {
      return JSON.parse(row.data as string);
    } catch {
      return undefined;
    }
  },

  // progress
  putProgress(email: string, worldId: string, snapshot: unknown): void {
    db.prepare("INSERT INTO progress (email, world_id, snapshot, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(email, world_id) DO UPDATE SET snapshot=excluded.snapshot, updated_at=excluded.updated_at").run(
      email, worldId, JSON.stringify(snapshot), new Date().toISOString(),
    );
  },
  getProgress(email: string, worldId: string): unknown | undefined {
    const row = db.prepare("SELECT snapshot FROM progress WHERE email = ? AND world_id = ?").get(email, worldId) as { snapshot: string } | undefined;
    if (!row) return undefined;
    try {
      return JSON.parse(row.snapshot as string);
    } catch {
      return undefined;
    }
  },

  // leaderboard
  upsertScore(worldId: string, user: string, missions: number, clues: number): { missions: number; clues: number; updatedAt: string } {
    const prev = db.prepare("SELECT missions, clues FROM board WHERE world_id = ? AND user = ?").get(worldId, user) as { missions: number; clues: number } | undefined;
    const keep = prev && (prev.missions > missions || (prev.missions === missions && prev.clues >= clues));
    const now = new Date().toISOString();
    const row = keep ? { missions: prev.missions, clues: prev.clues, updatedAt: now } : { missions, clues, updatedAt: now };
    db.prepare("INSERT INTO board (world_id, user, missions, clues, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(world_id, user) DO UPDATE SET missions=excluded.missions, clues=excluded.clues, updated_at=excluded.updated_at").run(
      worldId, user, row.missions, row.clues, row.updatedAt,
    );
    return row;
  },
  boardFor(worldId: string): RaceRow[] {
    const rows = db.prepare("SELECT user, missions, clues, updated_at AS updatedAt FROM board WHERE world_id = ?").all(worldId) as unknown as { user: string; missions: number; clues: number; updatedAt: string }[];
    return rank(rows.map((r) => ({ ...r, worldId, startedAt: r.updatedAt })));
  },
  allBoards(): Record<string, RaceRow[]> {
    const rows = db.prepare("SELECT world_id AS worldId, user, missions, clues, updated_at AS updatedAt FROM board").all() as unknown as RaceRow[];
    const out: Record<string, RaceRow[]> = {};
    for (const r of rows) (out[r.worldId] ??= []).push(r);
    for (const k of Object.keys(out)) out[k] = rank(out[k]);
    return out;
  },

  // rooms + racers
  putRoom(id: string, worldId: string, host: string): void {
    db.prepare("INSERT INTO rooms (id, world_id, host, created_at) VALUES (?, ?, ?, ?)").run(id, worldId, host, new Date().toISOString());
  },
  getRoom(id: string): { id: string; worldId: string; host: string; createdAt: string } | undefined {
    return db.prepare("SELECT id, world_id AS worldId, host, created_at AS createdAt FROM rooms WHERE id = ?").get(id) as { id: string; worldId: string; host: string; createdAt: string } | undefined;
  },
  putRacer(roomId: string, user: string, missions: number, clues: number, finished: boolean): void {
    const prev = db.prepare("SELECT started_at AS startedAt FROM racers WHERE room_id = ? AND user = ?").get(roomId, user) as { startedAt: string } | undefined;
    const now = new Date().toISOString();
    db.prepare("INSERT INTO racers (room_id, user, missions, clues, started_at, updated_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(room_id, user) DO UPDATE SET missions=excluded.missions, clues=excluded.clues, updated_at=excluded.updated_at, finished_at=excluded.finished_at").run(
      roomId, user, missions, clues, prev?.startedAt ?? now, now, finished ? now : null,
    );
  },
  racersFor(roomId: string, worldId: string): RaceRow[] {
    const rows = db.prepare("SELECT user, missions, clues, started_at AS startedAt, updated_at AS updatedAt, finished_at AS finishedAt FROM racers WHERE room_id = ?").all(roomId) as {
      user: string; missions: number; clues: number; startedAt: string; updatedAt: string; finishedAt: string | null;
    }[];
    return rank(rows.map((r) => ({ user: r.user, worldId, missions: r.missions, clues: r.clues, startedAt: r.startedAt, updatedAt: r.updatedAt, ...(r.finishedAt ? { finishedAt: r.finishedAt } : {}) })));
  },

  // presence
  heartbeat(worldId: string, email: string, pos: [number, number, number], suit: string, room: string): void {
    db.prepare("INSERT INTO presence (world_id, email, pos, suit, room, ts) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(world_id, email) DO UPDATE SET pos=excluded.pos, suit=excluded.suit, room=excluded.room, ts=excluded.ts").run(
      worldId, email, JSON.stringify(pos), suit, room, Date.now(),
    );
  },
  peersFor(worldId: string, roomId: string, windowMs: number): PresenceRow[] {
    const cutoff = Date.now() - windowMs;
    db.prepare("DELETE FROM presence WHERE ts < ?").run(cutoff);
    const rows = db.prepare("SELECT email, pos, suit, room FROM presence WHERE world_id = ?").all(worldId) as { email: string; pos: string; suit: string; room: string }[];
    const out: PresenceRow[] = [];
    for (const r of rows) {
      if (roomId && r.room !== roomId) continue;
      let pos: [number, number, number] = [0, 1.7, 6];
      try {
        const p = JSON.parse(r.pos) as [number, number, number];
        if (Array.isArray(p) && p.length === 3) pos = p;
      } catch {
        /* keep default */
      }
      out.push({ user: r.email.split("@")[0], pos, suit: r.suit, room: r.room });
    }
    return out;
  },
};

/** One-time import of legacy server/.data/*.json tables. */
export function migrateFromJson(): string[] {
  const done: string[] = [];
  const load = (name: string): unknown => {
    try {
      const p = join(dir, `${name}.json`);
      if (!existsSync(p)) return undefined;
      return JSON.parse(readFileSync(p, "utf8"));
    } catch {
      return undefined;
    }
  };
  const archive = (name: string): void => {
    try {
      mkdirSync(join(dir, "migrated"), { recursive: true });
      renameSync(join(dir, `${name}.json`), join(dir, "migrated", `${name}.json`));
    } catch {
      /* ignore */
    }
  };
  const codes = load("codes") as Record<string, { code: string; expiresAt: number }> | undefined;
  if (codes) {
    for (const [email, c] of Object.entries(codes)) {
      if (c.expiresAt > Date.now()) store.setCode(email, c.code, c.expiresAt);
    }
    archive("codes");
    done.push("codes");
  }
  const tokens = load("tokens") as Record<string, string> | undefined;
  if (tokens) {
    for (const [token, email] of Object.entries(tokens)) store.addToken(token, email);
    archive("tokens");
    done.push("tokens");
  }
  const worlds = load("worlds") as Record<string, { id?: string }> | undefined;
  if (worlds) {
    for (const [id, w] of Object.entries(worlds)) {
      store.putWorld(id, w, (w as { ownerId?: string }).ownerId ?? "");
    }
    archive("worlds");
    done.push("worlds");
  }
  const progress = load("progress") as Record<string, unknown> | undefined;
  if (progress) {
    for (const [key, snap] of Object.entries(progress)) {
      const sep = key.indexOf(":");
      if (sep > 0) store.putProgress(key.slice(0, sep), key.slice(sep + 1), snap);
    }
    archive("progress");
    done.push("progress");
  }
  const board = load("board") as Record<string, { user: string; missions: number; clues: number }[]> | undefined;
  if (board) {
    for (const [worldId, list] of Object.entries(board)) {
      for (const e of list ?? []) store.upsertScore(worldId, e.user, e.missions, e.clues);
    }
    archive("board");
    done.push("board");
  }
  const presence = load("presence") as Record<string, Record<string, { pos: [number, number, number]; suit: string }>> | undefined;
  if (presence) {
    for (const [worldId, room] of Object.entries(presence)) {
      for (const [email, p] of Object.entries(room ?? {})) {
        store.heartbeat(worldId, email, p.pos, p.suit, "");
      }
    }
    archive("presence");
    done.push("presence");
  }
  const rooms = load("rooms") as Record<string, { worldId: string; host: string; createdAt: string }> | undefined;
  if (rooms) {
    for (const [id, r] of Object.entries(rooms)) {
      try {
        store.putRoom(id, r.worldId, r.host);
      } catch {
        /* duplicate */
      }
    }
    archive("rooms");
    done.push("rooms");
  }
  const racers = load("racers") as Record<string, Record<string, { missions: number; clues: number; finishedAt?: string }>> | undefined;
  if (racers) {
    for (const [roomId, room] of Object.entries(racers)) {
      for (const [user, r] of Object.entries(room ?? {})) {
        store.putRacer(roomId, user, r.missions, r.clues, !!r.finishedAt);
      }
    }
    archive("racers");
    done.push("racers");
  }
  return done;
}
