// MYTHRA store contract — every backend (SQLite local, Postgres/Neon on
// Vercel) implements these 28 methods. Routes only ever touch `Store`,
// so swapping databases never touches game logic.
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

export interface Store {
  setCode(email: string, code: string, expiresAt: number): Promise<void>;
  getCode(email: string): Promise<{ code: string; expiresAt: number } | undefined>;
  delCode(email: string): Promise<void>;
  addToken(token: string, email: string): Promise<void>;
  emailForToken(token: string): Promise<string | null>;
  putWorld(id: string, data: unknown, owner: string): Promise<void>;
  listWorlds(): Promise<{ id: string; data: unknown; owner: string }[]>;
  getWorld(id: string): Promise<unknown | undefined>;
  putProgress(email: string, worldId: string, snapshot: unknown): Promise<void>;
  getProgress(email: string, worldId: string): Promise<unknown | undefined>;
  upsertScore(worldId: string, user: string, missions: number, clues: number): Promise<{ missions: number; clues: number; updatedAt: string }>;
  boardFor(worldId: string): Promise<RaceRow[]>;
  allBoards(): Promise<Record<string, RaceRow[]>>;
  putRoom(id: string, worldId: string, host: string): Promise<void>;
  getRoom(id: string): Promise<{ id: string; worldId: string; host: string; createdAt: string } | undefined>;
  putRoomWorld(roomId: string, world: unknown): Promise<void>;
  getRoomWorld(roomId: string): Promise<unknown | undefined>;
  putRacer(roomId: string, user: string, missions: number, clues: number, finished: boolean): Promise<void>;
  racersFor(roomId: string, worldId: string): Promise<RaceRow[]>;
  heartbeat(worldId: string, email: string, pos: [number, number, number], suit: string, room: string): Promise<void>;
  peersFor(worldId: string, roomId: string, windowMs: number): Promise<PresenceRow[]>;
  putLibrary(owner: string, data: unknown): Promise<string>;
  getLibrary(owner: string): Promise<{ data: unknown; updatedAt: string } | undefined>;
  putCheckpoints(owner: string, worldId: string, list: unknown): Promise<string>;
  getCheckpoints(owner: string, worldId: string): Promise<{ data: unknown; updatedAt: string } | undefined>;
  upsertDiscordUser(id: string, username: string, globalName: string | null, avatar: string | null): Promise<void>;
  saveState(state: string): Promise<void>;
  consumeState(state: string): Promise<boolean>;
}

export function rank(rows: RaceRow[]): RaceRow[] {
  return rows.sort((a, b) => {
    if (b.missions !== a.missions) return b.missions - a.missions;
    if (b.clues !== a.clues) return b.clues - a.clues;
    if (!!a.finishedAt !== !!b.finishedAt) return a.finishedAt ? -1 : 1;
    if (a.finishedAt && b.finishedAt && a.finishedAt !== b.finishedAt) return a.finishedAt < b.finishedAt ? -1 : 1;
    return a.startedAt < b.startedAt ? -1 : 1;
  });
}
