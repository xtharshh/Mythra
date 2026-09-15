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

export interface AdminStats {
  generatedAt: string;
  totals: {
    worlds: number;
    owners: number;
    plays: number;
    solvers: number;
    missionsSolved: number;
    cluesFound: number;
  };
  byTheme: Record<string, number>;
  byDifficulty: Record<string, number>;
  topWorlds: AdminWorldRow[];
  topPlayers: AdminPlayerRow[];
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

  for (const w of worlds) {
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

  return {
    generatedAt: new Date(now).toISOString(),
    totals: {
      worlds: worlds.length,
      owners: owners.size,
      plays,
      solvers: solvers.size,
      missionsSolved,
      cluesFound,
    },
    byTheme,
    byDifficulty,
    topWorlds: topWorlds.slice(0, 10),
    topPlayers: topPlayers.slice(0, 10),
  };
}
