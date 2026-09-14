// Story continuity: contributions extend the SAME story, forks start NEW ones (§18–19).
// Pure logic (testable headless) — the store wires it to UI + persistence.
import type {
  Clue,
  CommunityEntry,
  Contribution,
  ContributionKind,
  World,
  WorldPermissions,
  WorldVersion,
} from "../types";

export const CONTRIBUTION_LIMITS = {
  titleMin: 3,
  titleMax: 80,
  textMin: 10,
  textMax: 600,
  maxPendingPerAuthor: 5,
  maxPerAuthorPerDay: 10,
} as const;

export function kindAllowed(kind: ContributionKind, perms: WorldPermissions): boolean {
  switch (kind) {
    case "clue": return perms.allowClueCreation;
    case "note": return perms.allowClueCreation;
    case "story_fragment": return perms.allowStoryChanges;
    case "mission_idea": return perms.allowMissionCreation;
  }
}

export interface ContributionDraft {
  kind: ContributionKind;
  title: string;
  text: string;
  targetMissionId?: string;
  targetLocationId?: string;
}

/** Validate a player contribution before it enters the queue (§18.4 limits). */
export function validateContribution(
  draft: ContributionDraft,
  world: World,
  existing: Contribution[],
  author: string,
  now = new Date(),
): { ok: true } | { ok: false; error: string } {
  if (!kindAllowed(draft.kind, world.permissions)) {
    return { ok: false, error: `The creator doesn't allow ${draft.kind.replace("_", " ")} contributions in this story.` };
  }
  if (world.permissions.contributionMode === "owner_only" || world.permissions.contributionMode === "trusted_users_only") {
    return { ok: false, error: "This story only accepts contributions from approved authors." };
  }
  const title = draft.title.trim();
  const text = draft.text.trim();
  if (title.length < CONTRIBUTION_LIMITS.titleMin || title.length > CONTRIBUTION_LIMITS.titleMax) {
    return { ok: false, error: `Title must be ${CONTRIBUTION_LIMITS.titleMin}–${CONTRIBUTION_LIMITS.titleMax} characters.` };
  }
  if (text.length < CONTRIBUTION_LIMITS.textMin || text.length > CONTRIBUTION_LIMITS.textMax) {
    return { ok: false, error: `Text must be ${CONTRIBUTION_LIMITS.textMin}–${CONTRIBUTION_LIMITS.textMax} characters.` };
  }
  if (draft.targetMissionId && !world.missions.some((m) => m.id === draft.targetMissionId)) {
    return { ok: false, error: "Linked mission doesn't exist in this story." };
  }
  if (draft.targetLocationId && !world.locations.some((l) => l.id === draft.targetLocationId)) {
    return { ok: false, error: "Linked location doesn't exist in this story." };
  }
  const mine = existing.filter((c) => c.worldId === world.id && c.author === author && c.status !== "rejected");
  if (mine.some((c) => c.kind === draft.kind && c.title.trim().toLowerCase() === title.toLowerCase())) {
    return { ok: false, error: "You've already submitted this — duplicate detected." };
  }
  if (mine.filter((c) => c.status === "pending").length >= CONTRIBUTION_LIMITS.maxPendingPerAuthor) {
    return { ok: false, error: `You have ${CONTRIBUTION_LIMITS.maxPendingPerAuthor} pending — wait for review first.` };
  }
  const dayAgo = now.getTime() - 24 * 3600 * 1000;
  if (mine.filter((c) => new Date(c.createdAt).getTime() >= dayAgo).length >= CONTRIBUTION_LIMITS.maxPerAuthorPerDay) {
    return { ok: false, error: "Daily contribution limit reached — come back tomorrow." };
  }
  return { ok: true };
}

export function makeContribution(
  draft: ContributionDraft,
  worldId: string,
  author: string,
  autoApprove: boolean,
): Contribution {
  const now = new Date().toISOString();
  return {
    id: `c-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
    worldId,
    author,
    kind: draft.kind,
    title: draft.title.trim(),
    text: draft.text.trim(),
    targetMissionId: draft.targetMissionId || undefined,
    targetLocationId: draft.targetLocationId || undefined,
    status: autoApprove ? "approved" : "pending",
    createdAt: now,
    reviewedAt: autoApprove ? now : undefined,
  };
}

/**
 * Apply an APPROVED contribution to the world — the story continues.
 * Returns a new World (version bumped). Clues become discoverable in the
 * journal; notes/fragments/ideas extend the community story log.
 */
export function applyContribution(world: World, c: Contribution): World {
  const entry: CommunityEntry = {
    id: `entry-${c.id}`, kind: c.kind, title: c.title, text: c.text, author: c.author, at: c.createdAt,
  };
  const log = [...(world.communityLog ?? []), entry];
  let next: World = { ...world, communityLog: log };

  if (c.kind === "clue") {
    const clue: Clue = {
      id: `clue_${c.id}`,
      title: c.title,
      text: `${c.text} — contributed by ${c.author}.`,
      type: "note",
      locationId: c.targetLocationId ?? "loc_landing",
      relatedMissionId: c.targetMissionId,
      discoveryMethod: "observe",
      visibility: "visible",
      importance: "minor",
      misleading: false,
      optional: true,
    };
    // guard: location must exist (validated above, but stay total)
    if (!next.locations.some((l) => l.id === clue.locationId)) clue.locationId = next.locations[0]?.id ?? "loc_landing";
    next = { ...next, clues: [...next.clues, clue] };
  }
  if (c.kind === "story_fragment") {
    next = {
      ...next,
      story: {
        ...next.story,
        background: `${next.story.background}\n\n[Chapter by ${c.author} — ${c.title}] ${c.text}`,
      },
    };
  }
  if (c.kind === "note") {
    next = {
      ...next,
      story: { ...next.story, knownFacts: [...next.story.knownFacts, `${c.title}: ${c.text}`] },
    };
  }
  return {
    ...next,
    version: next.version + 1,
    updatedAt: new Date().toISOString(),
  };
}

/** Nearest location to a world position (XZ). Pure — powers "where I'm standing". */
export function nearestLocation(
  pos: readonly [number, number, number],
  locations: World["locations"],
): { id: string; name: string; dist: number } | null {
  if (locations.length === 0) return null;
  let best = locations[0];
  let bestD = Math.hypot(best.position[0] - pos[0], best.position[2] - pos[2]);
  for (const l of locations.slice(1)) {
    const d = Math.hypot(l.position[0] - pos[0], l.position[2] - pos[2]);
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return { id: best.id, name: best.name, dist: bestD };
}

/** Fork an existing story into a brand-new one (new id, draft status). */
export function forkWorld(world: World, authorName = "you"): World {
  const stamp = Date.now();
  const base = structuredClone(world) as unknown as World;
  return {
    ...base,
    id: `world-fork-${stamp.toString(36)}`,
    slug: `${world.slug}-fork-${stamp.toString(36)}`,
    name: `${world.name} — a new telling`,
    status: "draft",
    visibility: "private",
    version: 1,
    ownerId: `author-${authorName}`,
    communityLog: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function snapshotVersion(world: World, createdBy: string, changeSummary: string): WorldVersion {  return {
    id: `v-${world.id}-${world.version}-${Date.now().toString(36)}`,
    worldId: world.id,
    versionNumber: world.version,
    snapshot: structuredClone(world) as unknown as World,
    createdBy,
    changeSummary,
    createdAt: new Date().toISOString(),
  };
}
