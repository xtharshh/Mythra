// Zustand game store — local single-player state with localStorage persistence (§4.4, §3.1)
import { create } from "zustand";
import { healCollectGrants, healWorldTheme } from "../ai/providers";
import { applyContribution, snapshotVersion } from "../community/continuity";
import { ownerKey, saveOwner } from "../auth/auth";
import { api, apiOn, apiToken } from "../api/client";
import { checkpointKey, makeCheckpointId, pruneCheckpoints } from "../game/checkpoints";
import type { Checkpoint, CheckpointKind } from "../game/checkpoints";
import { loadVoiceNoteMetas, saveVoiceNoteMetas } from "../audio/voiceNotes";
import type { VoiceNoteMeta } from "../audio/voiceNotes";
import type { Contribution, GameState, World, WorldVersion } from "../types";

export interface ProgressSnapshot {
  inventory: Record<string, number>;
  discoveredClues: string[];
  completedMissions: string[];
  activeMissions: string[];
  solvedPuzzles: string[];
  inspectedObjects: string[];
  collectedObjects: string[];
  reachedLocations: string[];
  flags: Record<string, string | number | boolean>;
  notes: Record<string, string>;
  playerPos?: [number, number, number];
}

interface LumenStore {
  world: World | null;
  worlds: World[];
  contributions: Contribution[];
  versions: WorldVersion[];
  inventory: Record<string, number>;
  discoveredClues: string[];
  completedMissions: string[];
  activeMissions: string[];
  solvedPuzzles: string[];
  inspectedObjects: string[];
  collectedObjects: string[];
  reachedLocations: string[];
  flags: Record<string, string | number | boolean>;
  notes: Record<string, string>;
  voiceNotes: VoiceNoteMeta[];
  playerPos: [number, number, number];
  log: string[];
  setWorld: (w: World | null) => void;
  addWorld: (w: World) => void;
  updateWorld: (w: World) => void;
  /** Delete an unwanted story + its queue, versions, saves and checkpoints. */
  deleteWorld: (id: string) => void;
  submitContribution: (c: Contribution) => void;
  /** Approve/reject a contribution. Approval applies it to the story + snapshots a version. */
  reviewContribution: (id: string, approve: boolean) => void;
  /** Roll back the active world to a previous version snapshot. */
  rollbackToVersion: (versionNumber: number) => void;
  collect: (itemId: string, qty?: number) => void;
  inspectObject: (id: string) => void;
  /** Mark a picked-up object depleted so it vanishes from the scene. */
  collectObject: (id: string) => void;
  discoverClue: (id: string) => void;
  startMission: (id: string) => void;
  completeMission: (id: string, rewards?: { itemId?: string; quantity?: number }[]) => void;
  solvePuzzle: (id: string) => void;
  reachLocation: (id: string) => void;
  setFlag: (k: string, v: string | number | boolean) => void;
  setNote: (clueId: string, text: string) => void;
  loadVoiceNotes: () => void;
  addVoiceNote: (meta: VoiceNoteMeta) => void;
  removeVoiceNote: (id: string) => void;
  checkpoints: Checkpoint[];
  loadCheckpoints: () => void;
  createCheckpoint: (label: string, kind?: CheckpointKind) => void;
  restoreCheckpoint: (id: string) => void;
  deleteCheckpoint: (id: string) => void;
  plays: Record<string, number>;
  ratings: Record<string, { total: number; count: number; mine?: number }>;
  loadSocial: () => void;
  recordPlay: (worldId: string) => void;
  rateWorld: (worldId: string, stars: number) => void;
  publishWorld: () => void;
  unpublishWorld: () => void;
  movePlayer: (p: [number, number, number]) => void;
  pushLog: (msg: string) => void;
  save: (silent?: boolean) => void;
  load: () => void;
  persistLibrary: () => void;
  loadLibrary: () => void;
  /** Pull the cloud shelf (last-write-wins). Fire-and-forget safe. */
  syncLibraryFromServer: (owner: string) => void;
  /** Union-merge cloud checkpoints for one world. Fire-and-forget safe. */
  syncCheckpointsFromServer: (owner: string, worldId: string) => void;
  /** Reopen whoever's last tale (reload-safe). False when none stored. */
  restoreLastWorld: () => boolean;
  /** Hot-swap to whoever just signed in/out: reload their library, saves,
   *  checkpoints, voice notes + social — no page reload. */
  switchUser: () => void;
  reset: () => void;
  gameState: () => GameState;
}

const SAVE_KEY = "lumen-save-v1";
const LIB_KEY = "lumen-library-v1";
const LIB_META_KEY = "lumen-library-meta";
const PLAYS_KEY = "lumen-plays-v1";
const RATINGS_KEY = "lumen-ratings-v1";
const LAST_KEY = "lumen-last-world";

/** Fresh run progress (fresh expedition for whoever just signed in). */
function freshRun(): ProgressSnapshot {
  return {
    inventory: {}, discoveredClues: [], completedMissions: [], activeMissions: [],
    solvedPuzzles: [], inspectedObjects: [], collectedObjects: [], reachedLocations: ["loc_landing"],
    flags: {}, notes: {}, playerPos: [0, 1.7, 6],
  };
}

export interface LibraryData {
  worlds: World[];
  contributions: Contribution[];
  versions: WorldVersion[];
}

/** Library conflict rule: newest updatedAt wins (null/empty local loses to any remote). Pure. */
export function mergeLibrary(
  local: LibraryData,
  localAt: string | null,
  remote: Partial<LibraryData> | null,
  remoteAt: string | null,
): { data: LibraryData; updatedAt: string; fromRemote: boolean } {
  const localEmpty = local.worlds.length === 0 && local.contributions.length === 0 && local.versions.length === 0;
  if (remote && remoteAt && (localEmpty || !localAt || remoteAt > localAt)) {
    return {
      data: { worlds: remote.worlds ?? [], contributions: remote.contributions ?? [], versions: remote.versions ?? [] },
      updatedAt: remoteAt,
      fromRemote: true,
    };
  }
  return { data: local, updatedAt: localAt ?? new Date(0).toISOString(), fromRemote: false };
}

/** Checkpoint conflict rule: union by id (never lose either side), then prune. Pure. */
export function mergeCheckpoints(a: Checkpoint[], b: Checkpoint[]): Checkpoint[] {
  const map = new Map<string, Checkpoint>();
  for (const c of [...a, ...b]) {
    if (c && typeof c.id === "string") map.set(c.id, c);
  }
  return pruneCheckpoints([...map.values()]);
}

/** Trim a shelf to fit localStorage quota: full tales ALWAYS survive —
 *  only version snapshots (latest 5 per world) and old contributions
 *  (latest 100) are cut. Pure. */
export function pruneLibraryForPersist(data: LibraryData): LibraryData {
  const byWorld = new Map<string, WorldVersion[]>();
  for (const v of data.versions) {
    const list = byWorld.get(v.worldId) ?? [];
    list.push(v);
    byWorld.set(v.worldId, list);
  }
  const versions = [...byWorld.values()].flatMap((list) =>
    list.sort((a, b) => b.versionNumber - a.versionNumber).slice(0, 5),
  );
  return { worlds: data.worlds, contributions: data.contributions.slice(-100), versions };
}

function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(ownerKey(key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(ownerKey(key), JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

/** Cloud available = API configured + a live session token. */
function cloudOn(): boolean {
  try {
    return apiOn() && !!apiToken();
  } catch {
    return false;
  }
}

function snapshot(s: LumenStore): ProgressSnapshot {
  return {
    inventory: s.inventory, discoveredClues: s.discoveredClues, completedMissions: s.completedMissions,
    activeMissions: s.activeMissions, solvedPuzzles: s.solvedPuzzles, inspectedObjects: s.inspectedObjects,
    collectedObjects: s.collectedObjects,
    reachedLocations: s.reachedLocations, flags: s.flags, notes: s.notes, playerPos: s.playerPos,
  };
}

/** Debounced autosave for journal notes (typing never loses ink). */
let noteSaveTimer: ReturnType<typeof setTimeout> | null = null;

export const useLumen = create<LumenStore>((set, get) => ({
  world: null,
  worlds: [],
  contributions: [],
  versions: [],
  inventory: {},
  discoveredClues: [],
  completedMissions: [],
  activeMissions: [],
  solvedPuzzles: [],
  inspectedObjects: [],
  collectedObjects: [],
  reachedLocations: ["loc_landing"],
  flags: {},
  notes: {},
  voiceNotes: [],
  checkpoints: [],
  plays: {},
  ratings: {},
  playerPos: [0, 1.7, 6],
  log: ["Welcome to Mythio."],

  setWorld: (world) => {
    if (world) {
      if (healWorldTheme(world)) {
        get().pushLog(`🎨 ${world.name} re-dressed for neon streets — no more red dust.`);
      }
      const rewired = healCollectGrants(world);
      if (rewired > 0) {
        get().pushLog(`🔧 ${world.name}: ${rewired} pickup${rewired === 1 ? "" : "s"} rewired — collecting now works.`);
      }
    }
    if (world) {
      // the playing tale always lives in the shelf too, so a reload reopens
      // THIS tale — never the demo because the shelf forgot it
      set((s) => ({ world, worlds: s.worlds.some((x) => x.id === world.id) ? s.worlds : [...s.worlds, world] }));
      get().persistLibrary();
    } else {
      set({ world });
    }
    try {
      if (world) localStorage.setItem(ownerKey(LAST_KEY), world.id);
    } catch { /* ignore */ }
  },
  addWorld: (w) => {
    if (healWorldTheme(w)) {
      get().pushLog(`🎨 ${w.name} re-dressed for neon streets — no more red dust.`);
    }
    const rewired = healCollectGrants(w);
    if (rewired > 0) {
      get().pushLog(`🔧 ${w.name}: ${rewired} pickup${rewired === 1 ? "" : "s"} rewired — collecting now works.`);
    }
    set((s) => ({ worlds: [...s.worlds.filter((x) => x.id !== w.id), w], world: w }));
    try {
      localStorage.setItem(ownerKey(LAST_KEY), w.id);
    } catch { /* ignore */ }
    get().persistLibrary();
  },
  updateWorld: (w) => {
    set((s) => ({ worlds: s.worlds.map((x) => (x.id === w.id ? w : x)), world: s.world?.id === w.id ? w : s.world }));
    get().persistLibrary();
  },
  deleteWorld: (id) => {
    const s = get();
    const name = s.worlds.find((x) => x.id === id)?.name ?? (s.world?.id === id ? s.world.name : id);
    set((prev) => ({
      worlds: prev.worlds.filter((x) => x.id !== id),
      world: prev.world?.id === id ? null : prev.world,
      contributions: prev.contributions.filter((c) => c.worldId !== id),
      versions: prev.versions.filter((v) => v.worldId !== id),
    }));
    try {
      localStorage.removeItem(`${SAVE_KEY}:${saveOwner()}:${id}`);
      localStorage.removeItem(checkpointKey(saveOwner(), id));
      if (localStorage.getItem(ownerKey(LAST_KEY)) === id) localStorage.removeItem(ownerKey(LAST_KEY));
    } catch { /* ignore */ }
    get().persistLibrary();
    get().pushLog(`Deleted story: ${name}.`);
  },

  submitContribution: (c) => {
    // open mode auto-approves: apply immediately so the story continues at once
    if (c.status === "approved") {
      const target = get().worlds.find((w) => w.id === c.worldId) ?? get().world;
      if (target) {
        const applied = applyContribution(target, c);
        const version = snapshotVersion(applied, c.author, `Community ${c.kind} approved: ${c.title}`);
        set((s) => ({
          contributions: [...s.contributions, c],
          versions: [...s.versions, version],
          worlds: s.worlds.map((w) => (w.id === applied.id ? applied : w)),
          world: s.world?.id === applied.id ? applied : s.world,
        }));
        get().pushLog(`📖 Story continues: ${c.title}`);
        get().persistLibrary();
        return;
      }
    }
    set((s) => ({ contributions: [...s.contributions, c] }));
    get().pushLog(`✉ Contribution submitted: ${c.title} (awaiting review)`);
    get().persistLibrary();
  },

  reviewContribution: (id, approve) => {
    const c = get().contributions.find((x) => x.id === id);
    if (!c || c.status !== "pending") return;
    const reviewed: Contribution = { ...c, status: approve ? "approved" : "rejected", reviewedAt: new Date().toISOString() };
    if (!approve) {
      set((s) => ({ contributions: s.contributions.map((x) => (x.id === id ? reviewed : x)) }));
      get().pushLog(`Contribution rejected: ${c.title}`);
      get().persistLibrary();
      return;
    }
    const target = get().worlds.find((w) => w.id === c.worldId) ?? get().world;
    if (!target) return;
    const applied = applyContribution(target, reviewed);
    const version = snapshotVersion(applied, "creator", `Community ${c.kind} approved: ${c.title}`);
    set((s) => ({
      contributions: s.contributions.map((x) => (x.id === id ? reviewed : x)),
      versions: [...s.versions, version],
      worlds: s.worlds.map((w) => (w.id === applied.id ? applied : w)),
      world: s.world?.id === applied.id ? applied : s.world,
    }));
    get().pushLog(`📖 Story continues: ${c.title} (v${applied.version})`);
    get().persistLibrary();
  },

  rollbackToVersion: (versionNumber) => {
    const w = get().world;
    if (!w) return;
    const v = get().versions.filter((x) => x.worldId === w.id).find((x) => x.versionNumber === versionNumber);
    if (!v) return;
    const restored = { ...(structuredClone(v.snapshot) as World), updatedAt: new Date().toISOString() };
    const record = snapshotVersion(restored, "creator", `Rolled back to v${versionNumber}`);
    set((s) => ({
      versions: [...s.versions, record],
      worlds: s.worlds.map((x) => (x.id === restored.id ? restored : x)),
      world: restored,
    }));
    get().pushLog(`⏪ Rolled back to v${versionNumber}`);
    get().persistLibrary();
  },

  collect: (itemId, qty = 1) => set((s) => ({ inventory: { ...s.inventory, [itemId]: (s.inventory[itemId] ?? 0) + qty } })),
  inspectObject: (id) => set((s) => (s.inspectedObjects.includes(id) ? {} : { inspectedObjects: [...s.inspectedObjects, id] })),
  collectObject: (id) => set((s) => (s.collectedObjects.includes(id) ? {} : { collectedObjects: [...s.collectedObjects, id] })),
  discoverClue: (id) => set((s) => (s.discoveredClues.includes(id) ? {} : { discoveredClues: [...s.discoveredClues, id] })),
  startMission: (id) => set((s) => ({ activeMissions: s.activeMissions.includes(id) ? s.activeMissions : [...s.activeMissions, id] })),
  completeMission: (id, rewards = []) => set((s) => {
    const inventory = { ...s.inventory };
    for (const r of rewards) if (r.itemId) inventory[r.itemId] = (inventory[r.itemId] ?? 0) + (r.quantity ?? 1);
    return {
      completedMissions: s.completedMissions.includes(id) ? s.completedMissions : [...s.completedMissions, id],
      activeMissions: s.activeMissions.filter((m) => m !== id),
      inventory,
    };
  }),
  solvePuzzle: (id) => set((s) => (s.solvedPuzzles.includes(id) ? {} : { solvedPuzzles: [...s.solvedPuzzles, id] })),
  reachLocation: (id) => set((s) => (s.reachedLocations.includes(id) ? {} : { reachedLocations: [...s.reachedLocations, id] })),
  setFlag: (k, v) => set((s) => ({ flags: { ...s.flags, [k]: v } })),
  setNote: (clueId, text) => {
    set((s) => ({ notes: { ...s.notes, [clueId]: text } }));
    // notes persist where they are written: quiet-save shortly after typing
    try {
      if (noteSaveTimer !== null) clearTimeout(noteSaveTimer);
      noteSaveTimer = setTimeout(() => {
        noteSaveTimer = null;
        get().save(true);
      }, 1500);
    } catch {
      /* headless */
    }
  },
  loadVoiceNotes: () => set({ voiceNotes: loadVoiceNoteMetas() }),
  addVoiceNote: (meta) => {
    set((s) => {
      const next = [meta, ...s.voiceNotes.filter((n) => n.id !== meta.id)].slice(0, 200);
      saveVoiceNoteMetas(next);
      return { voiceNotes: next };
    });
  },
  removeVoiceNote: (id) => {
    set((s) => {
      const next = s.voiceNotes.filter((n) => n.id !== id);
      saveVoiceNoteMetas(next);
      return { voiceNotes: next };
    });
  },
  movePlayer: (p) => set({ playerPos: p }),
  pushLog: (msg) => set((s) => ({ log: [...s.log.slice(-49), msg] })),

  save: (silent) => {
    const s = get();
    if (!s.world) return;
    const snap = snapshot(s);
    try {
      // per-explorer saves; legacy guest key kept as fallback on load
      localStorage.setItem(`${SAVE_KEY}:${saveOwner()}:${s.world.id}`, JSON.stringify(snap));
      if (!silent) get().pushLog("Progress saved.");
    } catch { /* ignore */ }
    // cloud copy (ACID side) — best effort, never blocks the game
    if (cloudOn() && s.world) {
      const worldId = s.world.id;
      void api.saveProgress(worldId, snap).catch(() => undefined);
    }
  },
  load: () => {
    const s = get();
    if (!s.world) return;
    try {
      const raw =
        localStorage.getItem(`${SAVE_KEY}:${saveOwner()}:${s.world.id}`) ??
        localStorage.getItem(`${SAVE_KEY}:${s.world.id}`);
      if (!raw) {
        get().pushLog("No save found for this explorer.");
        return;
      }
      const snap = JSON.parse(raw) as ProgressSnapshot;
      set({ ...snap, collectedObjects: snap.collectedObjects ?? [], playerPos: snap.playerPos ?? [0, 1.7, 6] });
      get().pushLog("Progress restored.");
    } catch { /* ignore */ }
  },
  reset: () => set({ inventory: {}, discoveredClues: [], completedMissions: [], activeMissions: [], solvedPuzzles: [], inspectedObjects: [], collectedObjects: [], reachedLocations: ["loc_landing"], flags: {}, notes: {}, playerPos: [0, 1.7, 6], log: ["Welcome to Mythio.", "World reset."] }),

  persistLibrary: () => {
    const s = get();
    const data = { worlds: s.worlds, contributions: s.contributions, versions: s.versions };
    const updatedAt = new Date().toISOString();
    const writeShelf = (d: typeof data): boolean => {
      try {
        // per-username library (guests keep the legacy global key)
        localStorage.setItem(ownerKey(LIB_KEY), JSON.stringify(d));
        localStorage.setItem(ownerKey(LIB_META_KEY), JSON.stringify({ updatedAt }));
        return true;
      } catch {
        return false;
      }
    };
    if (writeShelf(data)) {
      // cloud copy (ACID side) — best effort, never blocks the game
      if (cloudOn()) {
        void api.pushLibrary(data).catch(() => undefined);
      }
      return;
    }
    // shelf outgrew the ~5MB localStorage quota: trim history (full tales
    // always survive) and retry, so the current tale is never lost on reload
    const pruned = pruneLibraryForPersist(data);
    if (writeShelf(pruned)) {
      set({ contributions: pruned.contributions, versions: pruned.versions });
      get().pushLog("Shelf trimmed to fit this browser — oldest history archived off, tales kept.");
      if (cloudOn()) {
        void api.pushLibrary(pruned).catch(() => undefined);
      }
      return;
    }
    get().pushLog("⚠ Shelf too large for this browser — reload may reopen the demo. Delete old tales.");
  },
  loadLibrary: () => {
    try {
      const raw = localStorage.getItem(ownerKey(LIB_KEY));
      // no stored shelf for this explorer → show an empty one (never the
      // previous sign-in's worlds)
      if (!raw) {
        set({ worlds: [], contributions: [], versions: [] });
        return;
      }
      const lib = JSON.parse(raw) as { worlds?: World[]; contributions?: Contribution[]; versions?: WorldVersion[] };
      set({ worlds: lib.worlds ?? [], contributions: lib.contributions ?? [], versions: lib.versions ?? [] });
    } catch { /* ignore corrupt */ }
  },
  syncLibraryFromServer: (owner) => {
    if (!cloudOn()) return;
    void (async () => {
      try {
        const remote = await api.library();
        if (!remote || saveOwner() !== owner) return;
        const s = get();
        const meta = readLocal<{ updatedAt?: string }>(LIB_META_KEY);
        const merged = mergeLibrary(
          { worlds: s.worlds, contributions: s.contributions, versions: s.versions },
          meta?.updatedAt ?? null,
          remote.data,
          remote.updatedAt ?? null,
        );
        if (merged.fromRemote && saveOwner() === owner) {
          set({ worlds: merged.data.worlds, contributions: merged.data.contributions, versions: merged.data.versions });
          writeLocal(LIB_KEY, merged.data);
          writeLocal(LIB_META_KEY, { updatedAt: merged.updatedAt });
          get().pushLog("Shelf synced from the cloud.");
        }
      } catch { /* offline — local shelf stands */ }
    })();
  },
  syncCheckpointsFromServer: (owner, worldId) => {
    if (!cloudOn()) return;
    void (async () => {
      try {
        const remote = await api.checkpoints(worldId);
        if (!remote || !Array.isArray(remote.data) || saveOwner() !== owner) return;
        const merged = mergeCheckpoints(get().checkpoints, remote.data as Checkpoint[]);
        if (saveOwner() !== owner) return;
        set({ checkpoints: merged });
        try {
          localStorage.setItem(checkpointKey(owner, worldId), JSON.stringify(merged));
        } catch { /* ignore */ }
      } catch { /* offline — local checkpoints stand */ }
    })();
  },
  restoreLastWorld: () => {
    try {
      const lastId = localStorage.getItem(ownerKey(LAST_KEY));
      if (!lastId) return false;
      const found = get().worlds.find((w) => w.id === lastId);
      if (!found) return false;
      const reopened = structuredClone(found);
      if (healWorldTheme(reopened)) {
        get().pushLog(`🎨 ${reopened.name} re-dressed for neon streets — no more red dust.`);
      }
      const rewired = healCollectGrants(reopened);
      if (rewired > 0) {
        get().pushLog(`🔧 ${reopened.name}: ${rewired} pickup${rewired === 1 ? "" : "s"} rewired — collecting now works.`);
      }
      set({ world: reopened });
      return true;
    } catch {
      return false;
    }
  },
  switchUser: () => {
    // reload every per-username slice for the new signer…
    get().loadLibrary();
    // …reopen their last tale (reload keeps the expedition)…
    if (!get().world) get().restoreLastWorld();
    get().loadVoiceNotes();
    get().loadSocial();
    get().loadCheckpoints();
    // …then hand them their own run: saved progress when they have it,
    // otherwise a fresh expedition on the current tale
    const w = get().world;
    if (w) {
      try {
        const raw = localStorage.getItem(`${SAVE_KEY}:${saveOwner()}:${w.id}`);
        if (raw) {
          const snap = JSON.parse(raw) as ProgressSnapshot;
          set({ ...snap, collectedObjects: snap.collectedObjects ?? [], playerPos: snap.playerPos ?? [0, 1.7, 6] });
        } else {
          set({ ...freshRun() });
        }
      } catch {
        set({ ...freshRun() });
      }
    } else {
      set({ ...freshRun() });
    }
    get().pushLog(`Now filing as ${saveOwner()}.`);
    // …and let the cloud fill the gaps (never clobbers local runs)
    if (cloudOn()) {
      const owner = saveOwner();
      get().syncLibraryFromServer(owner);
      const current = get().world;
      if (current) {
        get().syncCheckpointsFromServer(owner, current.id);
        try {
          if (!localStorage.getItem(`${SAVE_KEY}:${owner}:${current.id}`)) {
            void api.loadProgress(current.id).then((snap) => {
              if (snap && saveOwner() === owner) {
                set({ ...(snap as unknown as ProgressSnapshot), playerPos: (snap as { playerPos?: [number, number, number] }).playerPos ?? [0, 1.7, 6] });
                get().pushLog("Cloud save restored.");
              }
            }).catch(() => undefined);
          }
        } catch { /* ignore */ }
      }
    }
  },

  gameState: () => {
    const s = get();
    return {
      completedMissions: new Set(s.completedMissions),
      discoveredClues: new Set(s.discoveredClues),
      inventory: s.inventory,
      inspectedObjects: new Set(s.inspectedObjects),
      solvedPuzzles: new Set(s.solvedPuzzles),
      reachedLocations: new Set(s.reachedLocations),
      flags: s.flags,
    };
  },

  loadCheckpoints: () => {
    const s = get();
    if (!s.world) {
      set({ checkpoints: [] });
      return;
    }
    try {
      const raw = localStorage.getItem(checkpointKey(saveOwner(), s.world.id));
      const list = raw ? (JSON.parse(raw) as Checkpoint[]) : [];
      set({ checkpoints: Array.isArray(list) ? list : [] });
    } catch {
      set({ checkpoints: [] });
    }
  },
  createCheckpoint: (label, kind = "manual") => {
    const s = get();
    if (!s.world) return;
    const cp: Checkpoint = {
      id: makeCheckpointId(),
      worldId: s.world.id,
      owner: saveOwner(),
      label: label.slice(0, 80) || "Checkpoint",
      kind,
      createdAt: new Date().toISOString(),
      snapshot: snapshot(s),
    };
    const next = pruneCheckpoints([cp, ...s.checkpoints]);
    set({ checkpoints: next });
    try {
      localStorage.setItem(checkpointKey(cp.owner, cp.worldId), JSON.stringify(next));
    } catch { /* ignore quota */ }
    if (cloudOn()) {
      void api.pushCheckpoints(cp.worldId, next).catch(() => undefined);
    }
    get().pushLog(kind === "manual" ? `Checkpoint saved: ${cp.label}` : `Checkpoint: ${cp.label}`);
  },
  restoreCheckpoint: (id) => {
    const s = get();
    const cp = s.checkpoints.find((c) => c.id === id);
    if (!cp) return;
    set({ ...cp.snapshot, collectedObjects: cp.snapshot.collectedObjects ?? [], playerPos: cp.snapshot.playerPos ?? [0, 1.7, 6] });
    get().pushLog(`Restored checkpoint: ${cp.label}`);
  },
  deleteCheckpoint: (id) => {
    const s = get();
    const cp = s.checkpoints.find((c) => c.id === id);
    if (!cp) return;
    const next = s.checkpoints.filter((c) => c.id !== id);
    set({ checkpoints: next });
    try {
      localStorage.setItem(checkpointKey(cp.owner, cp.worldId), JSON.stringify(next));
    } catch { /* ignore */ }
    if (cloudOn()) {
      void api.pushCheckpoints(cp.worldId, next).catch(() => undefined);
    }
    get().pushLog(`Deleted checkpoint: ${cp.label}`);
  },

  loadSocial: () => {
    try {
      const plays = JSON.parse(localStorage.getItem(ownerKey(PLAYS_KEY)) ?? "{}") as Record<string, number>;
      const ratings = JSON.parse(localStorage.getItem(ownerKey(RATINGS_KEY)) ?? "{}") as LumenStore["ratings"];
      set({
        plays: plays && typeof plays === "object" ? plays : {},
        ratings: ratings && typeof ratings === "object" ? ratings : {},
      });
    } catch {
      /* ignore corrupt */
    }
  },
  recordPlay: (worldId) => {
    set((s) => {
      const plays = { ...s.plays, [worldId]: (s.plays[worldId] ?? 0) + 1 };
      try {
        localStorage.setItem(ownerKey(PLAYS_KEY), JSON.stringify(plays));
      } catch { /* ignore */ }
      return { plays };
    });
  },
  rateWorld: (worldId, stars) => {
    const clipped = Math.min(5, Math.max(1, Math.round(stars)));
    set((s) => {
      const prev = s.ratings[worldId] ?? { total: 0, count: 0 };
      const total = prev.total - (prev.mine ?? 0) + clipped;
      const count = prev.mine === undefined ? prev.count + 1 : prev.count;
      const ratings = { ...s.ratings, [worldId]: { total, count, mine: clipped } };
      try {
        localStorage.setItem(ownerKey(RATINGS_KEY), JSON.stringify(ratings));
      } catch { /* ignore */ }
      return { ratings };
    });
    get().pushLog(`Rated ${clipped}/5.`);
  },
  publishWorld: () => {
    const w = get().world;
    if (!w) return;
    get().updateWorld({ ...w, status: "published", updatedAt: new Date().toISOString() });
    get().pushLog(`Published: ${w.name} — visible to every solver in the Archive.`);
  },
  unpublishWorld: () => {
    const w = get().world;
    if (!w) return;
    get().updateWorld({ ...w, status: "draft", updatedAt: new Date().toISOString() });
    get().pushLog(`Unpublished: ${w.name} — back to draft.`);
  },
}));
