// Mythio backend store selector — SQLite locally, Postgres (Neon) when
// DATABASE_URL is set (Vercel). Routes only see the `Store` contract.
// SQLite (node:sqlite) loads lazily: serverless Node images without it
// must never crash on import.
import type { Store } from "./store.js";
import { createPgStore } from "./pg.js";

export let store: Store;
if (process.env.DATABASE_URL) {
  store = createPgStore();
} else {
  const { createSqliteStore } = await import("./sqlite.js");
  store = createSqliteStore();
}

export { migrateFromJson } from "./sqlite.js";
export type { PresenceRow, RaceRow, Store } from "./store.js";
