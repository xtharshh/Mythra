// MYTHRA backend store — file-backed JSON tables (Postgres later per arch).
// Zero-config: runs with `npm run dev:api`. All writes are atomic-ish.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), ".data");
mkdirSync(dir, { recursive: true });

export interface Tables {
  codes: Record<string, { code: string; expiresAt: number }>;
  tokens: Record<string, string>; // token -> email
  worlds: Record<string, unknown>; // published worlds by id
  progress: Record<string, unknown>; // `${email}:${worldId}` -> snapshot
  board: Record<string, { user: string; worldId: string; missions: number; clues: number; updatedAt: string }[]>;
  presence: Record<string, Record<string, { pos: [number, number, number]; suit: string; room: string; ts: number }>>;
  rooms: Record<string, { id: string; worldId: string; host: string; createdAt: string }>;
  racers: Record<string, Record<string, { missions: number; clues: number; startedAt: string; updatedAt: string; finishedAt?: string }>>;
}

const FILES: (keyof Tables)[] = ["codes", "tokens", "worlds", "progress", "board", "presence", "rooms", "racers"];
const cache = new Map<string, unknown>();

function path(name: string): string {
  return join(dir, `${name}.json`);
}

export function read<K extends keyof Tables>(table: K): Tables[K] {
  if (cache.has(table)) return cache.get(table) as Tables[K];
  try {
    const raw = readFileSync(path(table), "utf8");
    const data = JSON.parse(raw) as Tables[K];
    cache.set(table, data);
    return data;
  } catch {
    const empty = {} as Tables[K];
    cache.set(table, empty);
    return empty;
  }
}

export function write<K extends keyof Tables>(table: K, data: Tables[K]): void {
  cache.set(table, data);
  try {
    writeFileSync(path(table), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}
