// LUMEN shared types — derived from LUMEN_Full_Game_Documentation.md §§7–11, 18–19
export type WorldStatus = "draft" | "testing" | "published" | "archived";
export type WorldVisibility = "public" | "unlisted" | "private";
export type Difficulty = "beginner" | "easy" | "medium" | "hard" | "expert";
export type WorldTheme =
  | "mars" | "space" | "ocean" | "forest" | "fantasy" | "cyberpunk"
  | "ancient_ruins" | "desert" | "horror" | "post_apocalyptic" | "custom";

export interface EnvironmentConfig {
  type: WorldTheme;
  skyColor: string;
  fogColor: string;
  primaryColor: string;
  secondaryColor: string;
  gravity: number;
  atmosphere: "normal" | "thin" | "underwater" | "none";
  weather: "clear" | "rain" | "snow" | "fog" | "dust_storm" | "storm" | "none";
  timeOfDay: "day" | "night" | "sunset" | "dynamic";
  terrainSeed: number;
  ambientIntensity: number;
}

export interface StoryConfig {
  title: string;
  premise: string;
  background: string;
  centralConflict: string;
  playerRole: string;
  knownFacts: string[];
  hiddenTruths: string[];
  tone: "peaceful" | "mysterious" | "dark" | "adventurous" | "humorous" | "epic";
  canonicalEnding: string;
}

export type Condition =
  | { type: "mission_completed"; missionId: string }
  | { type: "clue_discovered"; clueId: string }
  | { type: "item_owned"; itemId: string; quantity: number }
  | { type: "object_inspected"; objectId: string }
  | { type: "puzzle_solved"; puzzleId: string }
  | { type: "location_reached"; locationId: string }
  | { type: "flag_equals"; key: string; value: string | number | boolean }
  | { type: "all"; conditions: Condition[] }
  | { type: "any"; conditions: Condition[] }
  | { type: "not"; condition: Condition };

export interface GameState {
  completedMissions: Set<string>;
  discoveredClues: Set<string>;
  inventory: Record<string, number>;
  inspectedObjects: Set<string>;
  solvedPuzzles: Set<string>;
  reachedLocations: Set<string>;
  flags: Record<string, string | number | boolean>;
}

export interface WorldLocation {
  id: string;
  name: string;
  description: string;
  position: [number, number, number];
  radius: number;
  parentLocationId?: string;
  locked: boolean;
  unlockCondition?: Condition;
  tags: string[];
}

export interface InteractionConfig {
  kind: "inspect" | "collect" | "solve" | "talk" | "activate" | "repair" | "build";
  givesItemId?: string;
  givesQuantity?: number;
  revealsClueId?: string;
  startsMissionId?: string;
  opensPuzzleId?: string;
  unlocksLocationId?: string;
  prompt?: string;
}

export interface WorldObject {
  id: string;
  type: "building" | "door" | "terminal" | "resource_node" | "vehicle" | "artifact"
    | "note" | "map" | "portal" | "npc" | "container" | "machine" | "landmark" | "crystal" | "creature";
  name: string;
  description: string;
  locationId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  modelId?: string;
  interaction?: InteractionConfig;
  visibility: "visible" | "hidden" | "locked";
  metadata?: Record<string, unknown>;
}

export interface WorldCharacter {
  id: string;
  name: string;
  role: string;
  dialogue: string[];
  locationId: string;
}

export interface ResourceDefinition {
  id: string;
  name: string;
  description: string;
  category: "material" | "energy" | "tool" | "key_item" | "food" | "oxygen" | "currency";
  stackable: boolean;
  maxStack: number;
  iconId?: string;
}

export interface MissionObjective {
  id: string;
  type: "collect_item" | "reach_location" | "inspect_object" | "solve_puzzle" | "repair_object"
    | "build_structure" | "talk_to_npc" | "activate_machine" | "discover_clue" | "deliver_item" | "survive_event";
  targetId?: string;
  quantity?: number;
  description: string;
  optional: boolean;
}

export interface Reward {
  itemId?: string;
  quantity?: number;
  flag?: string;
  flagValue?: string | number | boolean;
  unlocksLocationId?: string;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: "investigation" | "collection" | "construction" | "repair" | "exploration"
    | "puzzle" | "rescue" | "survival" | "delivery" | "conversation" | "discovery";
  order: number;
  difficulty: Difficulty;
  prerequisites: Condition[];
  objectives: MissionObjective[];
  rewards: Reward[];
  startCondition: Condition;
  completionCondition: Condition;
  failureCondition?: Condition;
  hidden: boolean;
  optional: boolean;
  estimatedMinutes: number;
}

export interface Clue {
  id: string;
  title: string;
  text: string;
  type: "note" | "symbol" | "audio" | "visual" | "object" | "dialogue" | "map" | "environmental" | "code" | "pattern" | "coordinate";
  locationId: string;
  objectId?: string;
  relatedMissionId?: string;
  relatedPuzzleId?: string;
  discoveryMethod: "inspect" | "collect" | "solve" | "talk" | "observe" | "activate" | "combine";
  visibility: "visible" | "hidden" | "locked" | "requires_item" | "requires_mission";
  requiredItemId?: string;
  requiredMissionId?: string;
  importance: "minor" | "normal" | "critical";
  misleading: boolean;
  optional: boolean;
  order?: number;
}

export interface ClueConnection {
  fromClueId: string;
  toClueId: string;
  relation: "reveals" | "points_to" | "unlocks" | "combines_with" | "explains" | "contradicts" | "misdirects";
}

export type PuzzleType = "sequence" | "logic" | "code" | "symbol" | "circuit" | "map" | "dialogue" | "resource" | "spatial" | "observation";
export interface PuzzleInput { id: string; label: string; kind: "text" | "choice" | "sequence"; choices?: string[] }
export interface PuzzleHint { order: number; text: string }
export interface Puzzle {
  id: string;
  title: string;
  description: string;
  type: PuzzleType;
  difficulty: Difficulty;
  locationId: string;
  relatedClueIds: string[];
  relatedMissionId?: string;
  inputs: PuzzleInput[];
  hints: PuzzleHint[];
  rewards: Reward[];
  solutionHash: string;
  /** plaintext only in mock/demo client; never ship real solutions to browser in prod */
  solution?: string;
  maxAttempts?: number;
}

export interface WorldEnding { id: string; title: string; description: string; condition: Condition; secret: boolean }

export interface WorldPermissions {
  allowVisitors: boolean;
  allowClueCreation: boolean;
  allowBuilding: boolean;
  allowMissionCreation: boolean;
  allowStoryChanges: boolean;
  contributionMode: "open" | "approval_required" | "trusted_users_only" | "owner_only";
}

export interface WorldSettings { sprintEnabled: boolean; worldBounds: number }

export interface World {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string;
  theme: WorldTheme;
  status: WorldStatus;
  visibility: WorldVisibility;
  difficulty: Difficulty;
  version: number;
  environment: EnvironmentConfig;
  story: StoryConfig;
  locations: WorldLocation[];
  objects: WorldObject[];
  characters: WorldCharacter[];
  resources: ResourceDefinition[];
  missions: Mission[];
  clues: Clue[];
  clueConnections: ClueConnection[];
  puzzles: Puzzle[];
  endings: WorldEnding[];
  permissions: WorldPermissions;
  settings: WorldSettings;
  /** Approved player contributions appended to the living story (§18). */
  communityLog?: CommunityEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ValidationIssue { code: string; message: string; entityId?: string }
export interface ValidationReport {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: ValidationIssue[];
  estimatedMinutes: number;
  missionCount: number;
  clueCount: number;
  puzzleCount: number;
  reachableLocations: number;
  unreachableLocations: number;
}

export interface WorldGenerationInput {
  prompt: string;
  difficulty: Difficulty;
  missionCount: number;
  clueDensity: "low" | "medium" | "high";
  puzzleIntensity: "low" | "medium" | "high";
  allowConstruction: boolean;
  allowPlayerContributions: boolean;
  tone?: StoryConfig["tone"];
  theme?: WorldTheme;
}

export interface AIProvider {
  generateWorldPlan(input: WorldGenerationInput): Promise<World>;
}

// ---- Community continuity (§18–19): extend the same story, or fork a new one.
export type ContributionKind = "clue" | "note" | "story_fragment" | "mission_idea";
export type ContributionStatus = "pending" | "approved" | "rejected";

export interface Contribution {
  id: string;
  worldId: string;
  author: string;
  kind: ContributionKind;
  title: string;
  text: string;
  targetMissionId?: string;
  targetLocationId?: string;
  status: ContributionStatus;
  createdAt: string;
  reviewedAt?: string;
}

export interface CommunityEntry {
  id: string;
  kind: ContributionKind;
  title: string;
  text: string;
  author: string;
  at: string;
}

export interface WorldVersion {
  id: string;
  worldId: string;
  versionNumber: number;
  snapshot: World;
  createdBy: string;
  changeSummary: string;
  createdAt: string;
}
