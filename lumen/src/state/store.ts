// Zustand game store — local single-player state with localStorage persistence (§4.4, §3.1)
import { create } from "zustand";
import { applyContribution, snapshotVersion } from "../community/continuity";
import { saveOwner } from "../auth/auth";
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
  reachedLocations: string[];
  flags: Record<string, string | number | boolean>;
  notes: Record<string, string>;
  voiceNotes: VoiceNoteMeta[];
  playerPos: [number, number, number];
  log: string[];
  setWorld: (w: World | null) => void;
  addWorld: (w: World) => void;
  updateWorld: (w: World) => void;
  submitContribution: (c: Contribution) => void;
  /** Approve/reject a contribution. Approval applies it to the story + snapshots a version. */
  reviewContribution: (id: string, approve: boolean) => void;
  /** Roll back the active world to a previous version snapshot. */
  rollbackToVersion: (versionNumber: number) => void;
  collect: (itemId: string, qty?: number) => void;
  inspectObject: (id: string) => void;
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
  movePlayer: (p: [number, number, number]) => void;
  pushLog: (msg: string) => void;
  save: () => void;
  load: () => void;
  persistLibrary: () => void;
  loadLibrary: () => void;
  reset: () => void;
  gameState: () => GameState;
}

const SAVE_KEY = "lumen-save-v1";
const LIB_KEY = "lumen-library-v1";

function snapshot(s: LumenStore): ProgressSnapshot {
  return {
    inventory: s.inventory, discoveredClues: s.discoveredClues, completedMissions: s.completedMissions,
    activeMissions: s.activeMissions, solvedPuzzles: s.solvedPuzzles, inspectedObjects: s.inspectedObjects,
    reachedLocations: s.reachedLocations, flags: s.flags, notes: s.notes, playerPos: s.playerPos,
  };
}

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
  reachedLocations: ["loc_landing"],
  flags: {},
  notes: {},
  voiceNotes: [],
  checkpoints: [],
  playerPos: [0, 1.7, 6],
  log: ["Welcome to LUMEN."],

  setWorld: (world) => set({ world }),
  addWorld: (w) => {
    set((s) => ({ worlds: [...s.worlds.filter((x) => x.id !== w.id), w], world: w }));
    get().persistLibrary();
  },
  updateWorld: (w) => {
    set((s) => ({ worlds: s.worlds.map((x) => (x.id === w.id ? w : x)), world: s.world?.id === w.id ? w : s.world }));
    get().persistLibrary();
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
  setNote: (clueId, text) => set((s) => ({ notes: { ...s.notes, [clueId]: text } })),
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

  save: () => {
    const s = get();
    if (!s.world) return;
    try {
      // per-explorer saves; legacy guest key kept as fallback on load
      localStorage.setItem(`${SAVE_KEY}:${saveOwner()}:${s.world.id}`, JSON.stringify(snapshot(s)));
      get().pushLog("Progress saved.");
    } catch { /* ignore */ }
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
      set({ ...snap, playerPos: snap.playerPos ?? [0, 1.7, 6] });
      get().pushLog("Progress restored.");
    } catch { /* ignore */ }
  },
  reset: () => set({ inventory: {}, discoveredClues: [], completedMissions: [], activeMissions: [], solvedPuzzles: [], inspectedObjects: [], reachedLocations: ["loc_landing"], flags: {}, notes: {}, playerPos: [0, 1.7, 6], log: ["Welcome to LUMEN.", "World reset."] }),

  persistLibrary: () => {
    const s = get();
    try {
      localStorage.setItem(LIB_KEY, JSON.stringify({ worlds: s.worlds, contributions: s.contributions, versions: s.versions }));
    } catch { /* ignore quota */ }
  },
  loadLibrary: () => {
    try {
      const raw = localStorage.getItem(LIB_KEY);
      if (!raw) return;
      const lib = JSON.parse(raw) as { worlds?: World[]; contributions?: Contribution[]; versions?: WorldVersion[] };
      set({ worlds: lib.worlds ?? [], contributions: lib.contributions ?? [], versions: lib.versions ?? [] });
    } catch { /* ignore corrupt */ }
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
    get().pushLog(kind === "manual" ? `Checkpoint saved: ${cp.label}` : `Checkpoint: ${cp.label}`);
  },
  restoreCheckpoint: (id) => {
    const s = get();
    const cp = s.checkpoints.find((c) => c.id === id);
    if (!cp) return;
    set({ ...cp.snapshot, playerPos: cp.snapshot.playerPos ?? [0, 1.7, 6] });
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
    get().pushLog(`Deleted checkpoint: ${cp.label}`);
  },
}));
