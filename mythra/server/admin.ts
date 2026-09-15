// Admin gate + analytics aggregation. Pure except env reads.
// Admins are allowlisted by email (ADMIN_EMAILS) plus a shared key
// (ADMIN_KEY), both server env — never shipped to the browser.
// With either unset, nobody is admin (safe default).
export interface AdminWorldRow {
  id: string;
  name: string;
  theme: string;
  difficulty: string;
  owner: string;
  plays: number;
  solvers: number;
  missions: number;
  clues: number;
}

export interface AdminPlayerRow {
  user: string;
  worlds: number;
  missions: number;
  clues: number;
}

export interface AdminOwnerRow {
  owner: string;
  worlds: number;
}

/** One registered identity: token email or Discord profile. */
export interface AdminUserRow {
  id: string;
  name: string;
  kind: "email" | "discord";
  online: boolean;
  worldId?: string;
}

export interface AdminOnlineUser {
  user: string;
  email: string;
  worldId: string;
  suit: string;
  at: string;
}

export interface AdminUsers {
  total: number;
  onlineCount: number;
  offlineCount: number;
  online: AdminOnlineUser[];
  /** Registered token emails with no fresh heartbeat (capped). */
  offline: string[];
  discord: AdminUserRow[];
}

/** One API request, as kept in the in-memory hit log (capped, since boot). */
export interface ApiHit {
  ts: number;
  method: string;
  route: string;
  status: number;
  ms: number;
  ip: string;
  country: string;
  /** Authenticated actor, "" when anonymous or the route isn't attributed. */
  user: string;
}

export interface AdminApiEndpoint {
  route: string;
  hits: number;
  errors: number;
  avgMs: number;
}

export interface AdminApiCountry {
  country: string;
  hits: number;
}

export interface AdminApi {
  /** In-memory log lives per process — Vercel serverless resets it. */
  sinceBoot: string;
  total: number;
  errors: number;
  byEndpoint: AdminApiEndpoint[];
  byCountry: AdminApiCountry[];
  recent: ApiHit[];
}

/** Per-user creation + extension activity. Worlds-published is durable;
 *  attempts/syncs come from the hit log (since boot). */
export interface CreatorRow {
  user: string;
  worldsPublished: number;
  createAttempts: number;
  createRejected: number;
  librarySyncs: number;
  checkpointPushes: number;
  roomsHosted: number;
}

export interface AdminStats {
  generatedAt: string;
  totals: {
    worlds: number;
    owners: number;
    plays: number;
    solvers: number;
    missionsSolved: number;
    cluesFound: number;
    users: number;
    onlineNow: number;
  };
  byTheme: Record<string, number>;
  byDifficulty: Record<string, number>;
  byOwner: AdminOwnerRow[];
  topWorlds: AdminWorldRow[];
  topPlayers: AdminPlayerRow[];
  users: AdminUsers;
  creators: CreatorRow[];
  api: AdminApi;
}

/** Env bag without needing node types (the web build typechecks this file). */
export type Env = { [k: string]: string | undefined };

function readEnv(): Env {
  try {
    const g = globalThis as unknown as { process?: { env?: Env } };
    return g.process?.env ?? {};
  } catch {
    return {};
  }
}

/** Lowercased allowlist from ADMIN_EMAILS ("a@x.co, b@y.co"). */
export function adminEmails(env: Env = readEnv()): string[] {
  return String(env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function isAdminEmail(email: unknown, env: Env = readEnv()): boolean {
  if (typeof email !== "string") return false;
  const clean = email.trim().toLowerCase();
  if (!clean) return false;
  if (!env.ADMIN_KEY) return false; // no key configured → locked
  return adminEmails(env).includes(clean);
}

interface BoardEntry {
  user?: unknown;
  missions?: unknown;
  clues?: unknown;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

/** Roll store rows into dashboard numbers. Defensive: world data is unknown-shaped. */
export function buildAdminStats(
  worlds: { id: string; data: unknown; owner: string }[],
  boards: Record<string, { user?: unknown; missions?: unknown; clues?: unknown }[]>,
  now = Date.now(),
): AdminStats {
  const owners = new Set<string>();
  const solvers = new Set<string>();
  const byTheme: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  const topWorlds: AdminWorldRow[] = [];
  const perPlayer = new Map<string, { worlds: Set<string>; missions: number; clues: number }>();
  let plays = 0;
  let missionsSolved = 0;
  let cluesFound = 0;

  const byOwnerCount = new Map<string, number>();
  for (const w of worlds) {
    if (w.owner) byOwnerCount.set(w.owner, (byOwnerCount.get(w.owner) ?? 0) + 1);
    const data = (w.data ?? {}) as Record<string, unknown>;
    const entries = Array.isArray(boards[w.id]) ? (boards[w.id] as BoardEntry[]) : [];
    const users = new Set<string>();
    let missions = 0;
    let clues = 0;
    for (const raw of entries) {
      if (!raw || typeof raw !== "object") continue; // corrupt board row
      const e = raw as BoardEntry;
      plays++;
      const user = str(e.user, "");
      if (user) {
        users.add(user);
        solvers.add(user);
        let row = perPlayer.get(user);
        if (!row) {
          row = { worlds: new Set<string>(), missions: 0, clues: 0 };
          perPlayer.set(user, row);
        }
        row.worlds.add(w.id);
        row.missions += num(e.missions);
        row.clues += num(e.clues);
      }
      missions += num(e.missions);
      clues += num(e.clues);
      missionsSolved += num(e.missions);
      cluesFound += num(e.clues);
    }
    if (w.owner) owners.add(w.owner);
    const theme = str(data.theme, "unknown");
    const difficulty = str(data.difficulty, "unknown");
    byTheme[theme] = (byTheme[theme] ?? 0) + 1;
    byDifficulty[difficulty] = (byDifficulty[difficulty] ?? 0) + 1;
    topWorlds.push({
      id: w.id,
      name: str(data.name, w.id),
      theme,
      difficulty,
      owner: w.owner || str(data.ownerId, "unknown"),
      plays: entries.length,
      solvers: users.size,
      missions,
      clues,
    });
  }
  topWorlds.sort((a, b) => b.plays - a.plays || b.solvers - a.solvers);
  const topPlayers: AdminPlayerRow[] = [...perPlayer.entries()].map(([user, r]) => ({
    user,
    worlds: r.worlds.size,
    missions: r.missions,
    clues: r.clues,
  }));
  topPlayers.sort((a, b) => b.missions - a.missions || b.clues - a.clues);

  const byOwner: AdminOwnerRow[] = [...byOwnerCount.entries()]
    .map(([owner, worlds]) => ({ owner, worlds }))
    .sort((a, b) => b.worlds - a.worlds || (a.owner < b.owner ? -1 : 1));
  return {
    generatedAt: new Date(now).toISOString(),
    totals: {
      worlds: worlds.length,
      owners: owners.size,
      plays,
      solvers: solvers.size,
      missionsSolved,
      cluesFound,
      users: 0,
      onlineNow: 0,
    },
    byTheme,
    byDifficulty,
    byOwner,
    topWorlds: topWorlds.slice(0, 10),
    topPlayers: topPlayers.slice(0, 10),
    users: { total: 0, onlineCount: 0, offlineCount: 0, online: [], offline: [], discord: [] },
    creators: [],
    api: { sinceBoot: new Date(now).toISOString(), total: 0, errors: 0, byEndpoint: [], byCountry: [], recent: [] },
  };
}

/** Split registered identities into online/offline from fresh heartbeats. Pure. */
export function splitUsers(
  tokenEmails: unknown,
  discordUsers: { id?: unknown; username?: unknown; globalName?: unknown }[],
  online: { email?: unknown; worldId?: unknown; suit?: unknown; ts?: unknown }[],
  now = Date.now(),
): AdminUsers {
  const emails = (Array.isArray(tokenEmails) ? tokenEmails : [])
    .filter((e): e is string => typeof e === "string" && e.length > 0);
  const seen = new Map<string, { worldId: string; suit: string; ts: number }>();
  const fresh: AdminOnlineUser[] = [];
  for (const raw of online) {
    if (!raw || typeof raw !== "object") continue;
    const email = str((raw as { email?: unknown }).email, "");
    if (!email || seen.has(email)) continue;
    const worldId = str((raw as { worldId?: unknown }).worldId, "");
    const suit = str((raw as { suit?: unknown }).suit, "");
    const ts = num((raw as { ts?: unknown }).ts);
    seen.set(email, { worldId, suit, ts });
    fresh.push({ user: email.split("@")[0] || email, email, worldId, suit, at: ts ? new Date(ts).toISOString() : new Date(now).toISOString() });
  }
  fresh.sort((a, b) => (a.email < b.email ? -1 : 1));
  const offline = emails.filter((e) => !seen.has(e)).sort().slice(0, 200);
  const discord: AdminUserRow[] = [];
  for (const raw of Array.isArray(discordUsers) ? discordUsers : []) {
    if (!raw || typeof raw !== "object") continue;
    const id = str((raw as { id?: unknown }).id, "");
    if (!id) continue;
    const username = str((raw as { username?: unknown }).username, id);
    const globalName = str((raw as { globalName?: unknown }).globalName, "");
    const hit = [...seen.keys()].find((e) => e === username || (globalName && e === globalName));
    const onlineRow = hit ? seen.get(hit) : undefined;
    discord.push({ id, name: username, kind: "discord", online: !!onlineRow, ...(onlineRow ? { worldId: onlineRow.worldId } : {}) });
  }
  return {
    total: new Set([...emails, ...discord.map((d) => `discord:${d.id}`)]).size,
    onlineCount: fresh.length,
    offlineCount: offline.length,
    online: fresh.slice(0, 100),
    offline,
    discord: discord.slice(0, 200),
  };
}

/** Endpoints whose hits carry the authenticated actor (creation/extension writes). */
export function attributedRoute(method: string, route: string): boolean {
  if (method === "POST" && route === "/api/worlds") return true;
  if (method === "PUT" && route === "/api/library") return true;
  if (method === "PUT" && route.startsWith("/api/checkpoints")) return true;
  if (method === "POST" && route.startsWith("/api/rooms")) return true;
  return false;
}

/** Roll the in-memory hit log into endpoint/country/user numbers. Pure. */
export function rollApiHits(hits: ApiHit[], now = Date.now(), recentLimit = 25): AdminApi {
  const list = Array.isArray(hits) ? hits : [];
  const byEp = new Map<string, { hits: number; errors: number; ms: number }>();
  const byCo = new Map<string, number>();
  let errors = 0;
  for (const h of list) {
    if (!h || typeof h !== "object") continue;
    const route = `${h.method || "?"} ${h.route || "?"}`;
    const ep = byEp.get(route) ?? { hits: 0, errors: 0, ms: 0 };
    ep.hits++;
    ep.ms += num(h.ms);
    if (num(h.status) >= 400) {
      ep.errors++;
      errors++;
    }
    byEp.set(route, ep);
    const country = str(h.country, "unknown") || "unknown";
    byCo.set(country, (byCo.get(country) ?? 0) + 1);
  }
  return {
    sinceBoot: new Date(now).toISOString(),
    total: list.length,
    errors,
    byEndpoint: [...byEp.entries()]
      .map(([route, r]) => ({ route, hits: r.hits, errors: r.errors, avgMs: r.hits ? Math.round(r.ms / r.hits) : 0 }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 30),
    byCountry: [...byCo.entries()]
      .map(([country, count]) => ({ country, hits: count }))
      .sort((a, b) => b.hits - a.hits),
    recent: list.slice(-recentLimit).reverse(),
  };
}

/** Per-user creation + extension activity. Worlds-published is durable (worlds
 *  table); attempts/syncs come from the attributed hit log (since boot). Pure. */
export function rollCreators(
  worlds: { owner?: unknown }[],
  hits: ApiHit[],
): CreatorRow[] {
  const rows = new Map<string, CreatorRow>();
  const row = (user: string): CreatorRow => {
    let r = rows.get(user);
    if (!r) {
      r = { user, worldsPublished: 0, createAttempts: 0, createRejected: 0, librarySyncs: 0, checkpointPushes: 0, roomsHosted: 0 };
      rows.set(user, r);
    }
    return r;
  };
  for (const w of Array.isArray(worlds) ? worlds : []) {
    const owner = w && typeof w === "object" ? str((w as { owner?: unknown }).owner, "") : "";
    if (owner) row(owner).worldsPublished++;
  }
  for (const h of Array.isArray(hits) ? hits : []) {
    if (!h || typeof h !== "object" || !h.user) continue;
    const r = row(h.user);
    if (h.method === "POST" && h.route === "/api/worlds") {
      r.createAttempts++;
      if (num(h.status) >= 400) r.createRejected++;
    } else if (h.method === "PUT" && h.route === "/api/library") {
      r.librarySyncs++;
    } else if (h.method === "PUT" && h.route.startsWith("/api/checkpoints")) {
      r.checkpointPushes++;
    } else if (h.method === "POST" && h.route.startsWith("/api/rooms")) {
      r.roomsHosted++;
    }
  }
  return [...rows.values()].sort(
    (a, b) => b.worldsPublished - a.worldsPublished || b.createAttempts - a.createAttempts || (a.user < b.user ? -1 : 1),
  );
}
