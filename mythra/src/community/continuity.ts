// Story continuity: contributions extend the SAME story, forks start NEW ones (§18–19).
// Pure logic (testable headless) — the store wires it to UI + persistence.
import type {
  Clue,
  CommunityEntry,
  Contribution,
  ContributionKind,
  World,
  WorldCharacter,
  WorldObject,
  WorldPermissions,
  WorldVersion,
} from "../types";

export const CONTRIBUTION_LIMITS = {
  titleMin: 3,
  titleMax: 80,
  textMin: 10,
  textMax: 5000,
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

const TITLE_FALLBACK = "Untitled discovery";

/** Derive a title from the body: first sentence-ish clause, word-cut, capped. Pure. */
export function deriveTitleFromText(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim().replace(/^["'“”‘’([]+/, "");
  if (!clean) return "";
  const cut = clean.search(/[.!?…]+(\s|$)/);
  let head = (cut > 0 ? clean.slice(0, cut) : clean).trim().replace(/["'“”‘’)\].,;:]+$/, "");
  if (head.length > CONTRIBUTION_LIMITS.titleMax) {
    head = head.slice(0, CONTRIBUTION_LIMITS.titleMax);
    const lastSpace = head.lastIndexOf(" ");
    if (lastSpace > 20) head = head.slice(0, lastSpace);
  }
  if (head.length < CONTRIBUTION_LIMITS.titleMin) return "";
  return head.charAt(0).toUpperCase() + head.slice(1);
}

/** Final filed title: yours when given, named from your text when blank, and
 *  combined from both when each adds something new. Pure. */
export function resolveContributionTitle(title: string, text: string): string {
  const own = title.replace(/\s+/g, " ").trim();
  const usableOwn = own.length >= CONTRIBUTION_LIMITS.titleMin ? own : "";
  const derived = deriveTitleFromText(text);
  if (!usableOwn) return derived || TITLE_FALLBACK;
  const cappedOwn = usableOwn.slice(0, CONTRIBUTION_LIMITS.titleMax);
  if (!derived || derived.toLowerCase() === cappedOwn.toLowerCase()) return cappedOwn;
  const combined = `${cappedOwn} — ${derived}`;
  if (combined.length <= CONTRIBUTION_LIMITS.titleMax) return combined;
  return cappedOwn;
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
  const title = resolveContributionTitle(draft.title, draft.text);
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
    title: resolveContributionTitle(draft.title, draft.text),
    text: draft.text.trim(),
    targetMissionId: draft.targetMissionId || undefined,
    targetLocationId: draft.targetLocationId || undefined,
    status: autoApprove ? "approved" : "pending",
    createdAt: now,
    reviewedAt: autoApprove ? now : undefined,
  };
}

/* ---------------- chapter props: named models become 3D ---------------- */
/* A chapter that names a train must grow a train. Word-boundary matching   */
/* ("car" never fires on "card"), catalog order, capped so a novel can't    */
/* flood the scene. Pure. */

interface ModelWord {
  id: string;
  label: string;
  type: WorldObject["type"];
  words: string[];
}

const MODEL_WORDS: ModelWord[] = [
  { id: "train", label: "Train", type: "vehicle", words: ["train", "trains", "carriage", "subway", "metro"] },
  { id: "rails", label: "Rails", type: "landmark", words: ["rail", "rails", "track", "tracks"] },
  { id: "platform", label: "Platform", type: "building", words: ["platform", "platforms"] },
  { id: "ticketgate", label: "Ticket gate", type: "machine", words: ["ticket gate", "ticket gates", "ticketgate", "turnstile", "barrier"] },
  { id: "tunnel", label: "Tunnel", type: "landmark", words: ["tunnel", "tunnels", "corridor", "passage"] },
  { id: "stationsign", label: "Station sign", type: "landmark", words: ["station sign", "departure board", "signboard"] },
  { id: "road", label: "Road", type: "landmark", words: ["road", "roads", "avenue", "highway", "street", "streets"] },
  { id: "car", label: "Car", type: "vehicle", words: ["car", "cars", "taxi"] },
  { id: "truck", label: "Truck", type: "vehicle", words: ["truck", "trucks", "lorry"] },
  { id: "bus", label: "Bus", type: "vehicle", words: ["bus", "buses"] },
  { id: "motorcycle", label: "Motorcycle", type: "vehicle", words: ["motorcycle", "motorbike"] },
  { id: "bicycle", label: "Bicycle", type: "vehicle", words: ["bicycle", "bicycles"] },
  { id: "streetlamp", label: "Streetlamp", type: "landmark", words: ["streetlamp", "lamppost", "streetlight"] },
  { id: "floorlamp", label: "Lamp", type: "artifact", words: ["bulb", "lamp", "lamps"] },
  { id: "trafficlight", label: "Traffic light", type: "machine", words: ["traffic light", "trafficlight", "stoplight"] },
  { id: "busstop", label: "Bus stop", type: "building", words: ["bus stop", "busstop"] },
  { id: "building", label: "Tower", type: "building", words: ["building", "buildings", "tower", "skyscraper"] },
  { id: "house", label: "House", type: "building", words: ["house", "houses", "hut", "cabin"] },
  { id: "shop", label: "Shop", type: "building", words: ["shop", "shops", "store", "stores", "stall", "stalls", "market", "bazaar", "grocery", "butcher", "meat shop"] },
  { id: "gaspump", label: "Fuel pump", type: "machine", words: ["gas pump", "gaspump", "fuel pump", "petrol", "fuel"] },
  { id: "bench", label: "Bench", type: "artifact", words: ["bench", "benches", "seat"] },
  { id: "console", label: "Console", type: "terminal", words: ["console", "terminal", "computer", "dashboard", "screen"] },
  { id: "recorder", label: "Recorder", type: "artifact", words: ["recorder", "announcement", "speaker"] },
  { id: "maptable", label: "Map table", type: "map", words: ["map table"] },
  { id: "billboard", label: "Billboard", type: "landmark", words: ["billboard", "poster", "posters", "hoarding"] },
  { id: "map", label: "Map", type: "map", words: ["map", "maps"] },
  { id: "crystal", label: "Crystal", type: "crystal", words: ["crystal", "crystals"] },
  { id: "campfire", label: "Campfire", type: "landmark", words: ["campfire", "bonfire"] },
  { id: "statue", label: "Statue", type: "landmark", words: ["statue", "monument"] },
  { id: "fountain", label: "Fountain", type: "landmark", words: ["fountain"] },
  { id: "tree", label: "Tree", type: "landmark", words: ["tree", "trees"] },
  { id: "tent", label: "Tent", type: "landmark", words: ["tent", "camp"] },
  { id: "torch", label: "Torch", type: "artifact", words: ["torch", "torches"] },
  { id: "drone", label: "Drone", type: "machine", words: ["drone", "drones"] },
  { id: "rover", label: "Rover", type: "vehicle", words: ["rover"] },
  { id: "locker", label: "Locker", type: "container", words: ["locker", "cabinet"] },
  { id: "beacon", label: "Beacon", type: "landmark", words: ["beacon"] },
  { id: "hatch", label: "Hatch", type: "door", words: ["hatch", "airlock"] },
  { id: "barrel", label: "Barrel", type: "container", words: ["barrel", "drum"] },
  { id: "hero", label: "Hero", type: "npc", words: ["hero", "heroes", "superhero", "superheroes", "champion", "villain", "mentor", "guardian"] },
  { id: "powerup", label: "Power orb", type: "artifact", words: ["power orb", "powerup", "ability orb"] },
];

export const MAX_CHAPTER_PROPS = 6;

/** Which catalog models the chapter names (title + text), in catalog
 *  order, capped — so "a train pulls forward on new rails" grows a train
 *  and rails. Pure. */
export function detectRequestedModels(title: string, text: string): ModelWord[] {
  const hay = `${title}\n${text}`.toLowerCase();
  const found: ModelWord[] = [];
  for (const m of MODEL_WORDS) {
    if (found.length >= MAX_CHAPTER_PROPS) break;
    if (m.words.some((w) => new RegExp(`\\b${w}\\b`).test(hay))) found.push(m);
  }
  return found;
}

/* ---------------- chapter cast: named people arrive as NPCs ---------------- */
/* "2 shops with a shopkeeper I can talk to" → a talking shopkeeper by the  */
/* stalls. Count words only count next to people words ("2 shops" never      */
/* inflates the cast). Pure. */

interface PeopleWord {
  role: string;
  name: string;
  words: string[];
}

const PEOPLE_WORDS: PeopleWord[] = [
  { role: "Shopkeeper", name: "Shopkeeper", words: ["shopkeeper", "stall keeper", "storekeeper"] },
  { role: "Vendor", name: "Vendor", words: ["vendor", "vendors", "merchant", "hawker"] },
  { role: "Guard", name: "Guard", words: ["guard", "guards", "watchman", "constable"] },
  { role: "Traveler", name: "Traveler", words: ["traveler", "traveller", "passenger", "commuter", "stranger"] },
  { role: "Child", name: "Child", words: ["child", "children", "kid", "boy", "girl"] },
  { role: "Local", name: "Local", words: ["person", "people", "folk", "crowd", "man", "woman", "men", "women"] },
];

const COUNT_WORDS: Array<[RegExp, number]> = [
  [/\b(one|1)\b/, 1], [/\b(two|2)\b/, 2], [/\b(three|3)\b/, 3],
  [/\b(four|4)\b/, 4], [/\b(five|5)\b/, 5],
];
const PEOPLE_NOUNS = "(?:person|people|persons|folk|crowd|men|women|man|woman|travelers?|travellers?|passengers?|commuters?|strangers?|children|child|kids?|boys?|girls?|guards?|vendors?|merchants?|hawkers?|shopkeepers?|locals?)";

export const MAX_CHAPTER_PEOPLE = 3;

/** Who the chapter asks for, e.g. [{role Vendor}] or "2, 3 people" → three
 *  Locals. Empty when nobody is named. Pure. */
export function detectRequestedPeople(title: string, text: string): Array<{ role: string; name: string }> {
  const hay = `${title}\n${text}`.toLowerCase();
  const hit = PEOPLE_WORDS.find((p) => p.words.some((w) => new RegExp(`\\b${w}\\b`).test(hay)));
  if (!hit) return [];
  let n = 1;
  for (const [re, v] of COUNT_WORDS) {
    if (new RegExp(`${re.source}\\s+${PEOPLE_NOUNS}`).test(hay)) n = Math.max(n, v);
  }
  n = Math.min(n, MAX_CHAPTER_PEOPLE);
  return Array.from({ length: n }, (_, i) => ({
    role: hit.role,
    name: n === 1 ? hit.name : `${hit.name} ${i + 1}`,
  }));
}

/** Grow the chapter's named models as inspectable 3D props in a row at the
 *  chapter's site (existing props are never duplicated). Pure. */
export function materializeChapterProps(world: World, c: Contribution): World {
  const models = detectRequestedModels(c.title, c.text);
  const people = detectRequestedPeople(c.title, c.text);
  if (models.length === 0 && people.length === 0) return world;
  const site = (c.targetLocationId && world.locations.find((l) => l.id === c.targetLocationId))
    ?? world.locations[0];
  if (!site) return world;
  const inBounds = (n: number) => Math.max(-55, Math.min(55, n));
  const firstLine = c.text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0]?.slice(0, 200) ?? c.title;
  const freshModels = models.filter((m) => !world.objects.some((o) => o.id === `obj_${c.id}_${m.id}`));
  const props: WorldObject[] = freshModels.map((m, i) => ({
    id: `obj_${c.id}_${m.id}`,
    type: m.type,
    modelId: m.id,
    name: `${m.label} — ${c.title}`,
    description: `Raised by ${c.author}'s chapter: ${c.title}.`,
    locationId: site.id,
    position: [
      inBounds(site.position[0] + (i - (freshModels.length - 1) / 2) * 4),
      0.5,
      inBounds(site.position[2] + 2.5),
    ] as [number, number, number],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    interaction: { kind: "inspect", prompt: `Inspect ${m.label.toLowerCase()}` },
    visibility: "visible",
  }));
  // the cast: talking NPCs beside the new props (survivor body, talk prompt)
  const freshPeople = people.filter((_, i) => !world.objects.some((o) => o.id === `obj_${c.id}_npc${i}`));
  const cast: WorldCharacter[] = [];
  const bodies: WorldObject[] = [];
  freshPeople.forEach((p, i) => {
    const charId = `char_${c.id}_${i}`;
    if (!world.characters.some((ch) => ch.id === charId)) {
      cast.push({
        id: charId,
        name: p.name,
        role: `${p.role} · ${c.title}`,
        dialogue: [firstLine, `${c.title} — ask me what I saw.`],
        locationId: site.id,
      });
    }
    bodies.push({
      id: `obj_${c.id}_npc${i}`,
      type: "npc",
      modelId: "survivor",
      name: p.name,
      description: `${p.role} from ${c.author}'s chapter: ${c.title}.`,
      locationId: site.id,
      position: [
        inBounds(site.position[0] + 3 + i * 2),
        0.5,
        inBounds(site.position[2] - 1.5),
      ] as [number, number, number],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      interaction: { kind: "talk", prompt: `Talk to ${p.name.toLowerCase()}` },
      visibility: "visible",
    });
  });
  if (props.length === 0 && cast.length === 0 && bodies.length === 0) return world;
  return {
    ...world,
    objects: [...world.objects, ...props, ...bodies],
    characters: [...world.characters, ...cast],
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
    // materialize: a 3D cache at the site — walk up, inspect it, pocket the clue
    const site = next.locations.find((l) => l.id === clue.locationId) ?? next.locations[0];
    const cacheId = `obj_${c.id}`;
    if (site && !next.objects.some((o) => o.id === cacheId)) {
      const inBounds = (n: number) => Math.max(-55, Math.min(55, n));
      next = {
        ...next,
        objects: [
          ...next.objects,
          {
            id: cacheId,
            type: "artifact",
            modelId: "crystal",
            name: `${c.title} cache`,
            description: `Something left behind: ${c.title}.`,
            locationId: site.id,
            position: [inBounds(site.position[0] + 2), 1, inBounds(site.position[2] + 2)],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            interaction: { kind: "inspect", prompt: `Inspect ${c.title}`, revealsClueId: clue.id },
            visibility: "visible",
          },
        ],
      };
    }
  }
  if (c.kind === "mission_idea") {
    // materialize: a real mission + its 3D marker at the site — take it, solve it
    const markerId = `obj_${c.id}`;
    const missionId = `m_${c.id}`;
    const siteId = c.targetLocationId && next.locations.some((l) => l.id === c.targetLocationId)
      ? c.targetLocationId
      : (next.locations[0]?.id ?? "loc_landing");
    const site = next.locations.find((l) => l.id === siteId);
    if (site && !next.objects.some((o) => o.id === markerId)) {
      const inBounds = (n: number) => Math.max(-55, Math.min(55, n));
      next = {
        ...next,
        objects: [
          ...next.objects,
          {
            id: markerId,
            type: "landmark",
            modelId: "beacon",
            name: c.title,
            description: c.text,
            locationId: site.id,
            position: [inBounds(site.position[0] - 2), 1, inBounds(site.position[2] - 2)],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            interaction: { kind: "inspect", prompt: `Take mission: ${c.title}`, startsMissionId: missionId },
            visibility: "visible",
          },
        ],
      };
    }
    if (!next.missions.some((m) => m.id === missionId)) {
      const order = next.missions.reduce((top, m) => Math.max(top, m.order), -1) + 1;
      next = {
        ...next,
        missions: [
          ...next.missions,
          {
            id: missionId,
            title: c.title,
            description: `${c.text} — proposed by ${c.author}.`,
            type: "exploration",
            order,
            difficulty: next.difficulty,
            prerequisites: [],
            objectives: [
              { id: `o_${c.id}`, type: "inspect_object", targetId: markerId, description: `Inspect ${c.title}`, optional: false },
            ],
            rewards: [],
            startCondition: { type: "all", conditions: [] },
            completionCondition: { type: "all", conditions: [{ type: "object_inspected", objectId: markerId }] },
            hidden: false,
            optional: false,
            estimatedMinutes: 5,
          },
        ],
      };
    }
  }
  if (c.kind === "story_fragment") {
    next = {
      ...next,
      story: {
        ...next.story,
        background: `${next.story.background}\n\n[Chapter by ${c.author} — ${c.title}] ${c.text}`,
      },
    };
    // materialize: every catalog model the chapter names grows a 3D prop
    // at the chapter's site — the train you imagined actually arrives
    next = materializeChapterProps(next, c);
  }
  if (c.kind === "note") {
    next = {
      ...next,
      story: { ...next.story, knownFacts: [...next.story.knownFacts, `${c.title}: ${c.text}`] },
    };
    next = materializeChapterProps(next, c);
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

/** "Chapter N" label for the Nth continued tale (1-based). Pure. */
export function chapterNumber(index: number): string {
  return `Chapter ${index + 1}`;
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
