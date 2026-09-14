// Zod schemas — enforce §13.1 schema validation + §12.3 AI output contract
import { z } from "zod";

export const conditionSchema: z.ZodTypeAny = z.lazy(() =>
  z.union([
    z.object({ type: z.literal("mission_completed"), missionId: z.string().min(1) }),
    z.object({ type: z.literal("clue_discovered"), clueId: z.string().min(1) }),
    z.object({ type: z.literal("item_owned"), itemId: z.string().min(1), quantity: z.number().int().min(1) }),
    z.object({ type: z.literal("object_inspected"), objectId: z.string().min(1) }),
    z.object({ type: z.literal("puzzle_solved"), puzzleId: z.string().min(1) }),
    z.object({ type: z.literal("location_reached"), locationId: z.string().min(1) }),
    z.object({ type: z.literal("flag_equals"), key: z.string().min(1), value: z.union([z.string(), z.number(), z.boolean()]) }),
    z.object({ type: z.literal("all"), conditions: z.array(conditionSchema) }),
    z.object({ type: z.literal("any"), conditions: z.array(conditionSchema) }),
    z.object({ type: z.literal("not"), condition: conditionSchema }),
  ])
);

const vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const worldLocationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  position: vec3,
  radius: z.number().positive(),
  parentLocationId: z.string().optional(),
  locked: z.boolean(),
  unlockCondition: conditionSchema.optional(),
  tags: z.array(z.string()),
});

export const interactionSchema = z.object({
  kind: z.enum(["inspect", "collect", "solve", "talk", "activate", "repair", "build"]),
  givesItemId: z.string().optional(),
  givesQuantity: z.number().int().positive().optional(),
  revealsClueId: z.string().optional(),
  startsMissionId: z.string().optional(),
  opensPuzzleId: z.string().optional(),
  unlocksLocationId: z.string().optional(),
  prompt: z.string().optional(),
});

export const worldObjectSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["building","door","terminal","resource_node","vehicle","artifact","note","map","portal","npc","container","machine","landmark","crystal","creature"]),
  name: z.string().min(1),
  description: z.string(),
  locationId: z.string().min(1),
  position: vec3,
  rotation: vec3,
  scale: vec3,
  modelId: z.string().optional(),
  interaction: interactionSchema.optional(),
  visibility: z.enum(["visible","hidden","locked"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const resourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.enum(["material","energy","tool","key_item","food","oxygen","currency"]),
  stackable: z.boolean(),
  maxStack: z.number().int().positive(),
  iconId: z.string().optional(),
});

export const missionObjectiveSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["collect_item","reach_location","inspect_object","solve_puzzle","repair_object","build_structure","talk_to_npc","activate_machine","discover_clue","deliver_item","survive_event"]),
  targetId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  description: z.string().min(1),
  optional: z.boolean(),
});

export const rewardSchema = z.object({
  itemId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  flag: z.string().optional(),
  flagValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  unlocksLocationId: z.string().optional(),
});

export const missionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  type: z.enum(["investigation","collection","construction","repair","exploration","puzzle","rescue","survival","delivery","conversation","discovery"]),
  order: z.number().int().min(0),
  difficulty: z.enum(["beginner","easy","medium","hard","expert"]),
  prerequisites: z.array(conditionSchema),
  objectives: z.array(missionObjectiveSchema).min(1),
  rewards: z.array(rewardSchema),
  startCondition: conditionSchema,
  completionCondition: conditionSchema,
  failureCondition: conditionSchema.optional(),
  hidden: z.boolean(),
  optional: z.boolean(),
  estimatedMinutes: z.number().min(0),
});

export const clueSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
  type: z.enum(["note","symbol","audio","visual","object","dialogue","map","environmental","code","pattern","coordinate"]),
  locationId: z.string().min(1),
  objectId: z.string().optional(),
  relatedMissionId: z.string().optional(),
  relatedPuzzleId: z.string().optional(),
  discoveryMethod: z.enum(["inspect","collect","solve","talk","observe","activate","combine"]),
  visibility: z.enum(["visible","hidden","locked","requires_item","requires_mission"]),
  requiredItemId: z.string().optional(),
  requiredMissionId: z.string().optional(),
  importance: z.enum(["minor","normal","critical"]),
  misleading: z.boolean(),
  optional: z.boolean(),
  order: z.number().int().optional(),
});

export const puzzleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  type: z.enum(["sequence","logic","code","symbol","circuit","map","dialogue","resource","spatial","observation"]),
  difficulty: z.enum(["beginner","easy","medium","hard","expert"]),
  locationId: z.string().min(1),
  relatedClueIds: z.array(z.string()),
  relatedMissionId: z.string().optional(),
  inputs: z.array(z.object({ id: z.string(), label: z.string(), kind: z.enum(["text","choice","sequence"]), choices: z.array(z.string()).optional() })),
  hints: z.array(z.object({ order: z.number().int(), text: z.string() })),
  rewards: z.array(rewardSchema),
  solutionHash: z.string().min(1),
  solution: z.string().optional(),
  maxAttempts: z.number().int().positive().optional(),
});

export const worldSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string(),
  theme: z.enum(["mars","space","ocean","forest","fantasy","cyberpunk","ancient_ruins","desert","horror","post_apocalyptic","custom"]),
  status: z.enum(["draft","testing","published","archived"]),
  visibility: z.enum(["public","unlisted","private"]),
  difficulty: z.enum(["beginner","easy","medium","hard","expert"]),
  version: z.number().int().min(1),
  environment: z.object({
    type: z.enum(["mars","space","ocean","forest","fantasy","cyberpunk","ancient_ruins","desert","horror","post_apocalyptic","custom"]),
    skyColor: z.string(), fogColor: z.string(), primaryColor: z.string(), secondaryColor: z.string(),
    gravity: z.number(), atmosphere: z.enum(["normal","thin","underwater","none"]),
    weather: z.enum(["clear","rain","snow","fog","dust_storm","storm","none"]),
    timeOfDay: z.enum(["day","night","sunset","dynamic"]),
    terrainSeed: z.number().int(), ambientIntensity: z.number(),
  }),
  story: z.object({
    title: z.string(), premise: z.string(), background: z.string(), centralConflict: z.string(),
    playerRole: z.string(), knownFacts: z.array(z.string()), hiddenTruths: z.array(z.string()),
    tone: z.enum(["peaceful","mysterious","dark","adventurous","humorous","epic"]), canonicalEnding: z.string(),
  }),
  locations: z.array(worldLocationSchema).min(1).max(30),
  objects: z.array(worldObjectSchema).max(500),
  characters: z.array(z.object({ id: z.string(), name: z.string(), role: z.string(), dialogue: z.array(z.string()), locationId: z.string() })),
  resources: z.array(resourceSchema),
  missions: z.array(missionSchema).max(50),
  clues: z.array(clueSchema).max(50),
  clueConnections: z.array(z.object({ fromClueId: z.string(), toClueId: z.string(), relation: z.enum(["reveals","points_to","unlocks","combines_with","explains","contradicts","misdirects"]) })),
  puzzles: z.array(puzzleSchema).max(30),
  endings: z.array(z.object({ id: z.string(), title: z.string(), description: z.string(), condition: conditionSchema, secret: z.boolean() })),
  permissions: z.object({ allowVisitors: z.boolean(), allowClueCreation: z.boolean(), allowBuilding: z.boolean(), allowMissionCreation: z.boolean(), allowStoryChanges: z.boolean(), contributionMode: z.enum(["open","approval_required","trusted_users_only","owner_only"]) }),
  settings: z.object({ sprintEnabled: z.boolean(), worldBounds: z.number().positive() }),
  branding: z.object({
    station: z.string().min(1).max(24),
    sol: z.string().min(1).max(16),
    tagline: z.string().min(1).max(80),
  }).optional(),
  createdAt: z.string(), updatedAt: z.string(),
});
