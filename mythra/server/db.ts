// Mythio backend store selector — SQLite locally, Postgres (Neon) when
// DATABASE_URL is set (Vercel). Routes only see the `Store` contract.
import { createPgStore } from "./pg.js";
import { createSqliteStore, migrateFromJson } from "./sqlite.js";
import type { Store } from "./store.js";

export const store: Store = process.env.DATABASE_URL ? createPgStore() : createSqliteStore();

export { migrateFromJson };
export type { PresenceRow, RaceRow, Store } from "./store.js";
