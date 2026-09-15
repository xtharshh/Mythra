// Universal AI providers (skills.md AI-Director): bring ANY key —
// OpenAI, Anthropic, Gemini, OpenRouter, Groq, Mistral, Ollama, custom
// OpenAI-compatible endpoints — or run keyless on Mock.
//
// Keys resolve in this order (first non-empty wins):
//   1. the signed-in explorer's own key (this browser, per-user + online/offline)
//   2. the site key from env (VITE_<PROVIDER>_API_KEY, set by the host in .env)
//   3. Mock — always available, no key needed.
// User keys live ONLY in localStorage; they are sent to the chosen provider
// and nowhere else. Every output is Zod-checked; failures fall back to Mock.
import { MockProvider } from "./mockProvider";
import { worldSchema } from "../schemas";
import type { World, WorldGenerationInput } from "../types";
import type { ContributionKind } from "../types";
import { resolveContributionTitle } from "../community/continuity";
import { loadEntryChoice, loadSession } from "../auth/auth";

export type AIProviderId =
  | "mock" | "openai" | "anthropic" | "gemini" | "openrouter"
  | "groq" | "mistral" | "nim" | "ollama" | "custom";

export interface AIConfig {
  provider: AIProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
  /** "system" = host's site key from env · "custom" = explorer's own key */
  keySource: "system" | "custom";
}

export interface ProviderMeta {
  id: AIProviderId;
  label: string;
  defaultModel: string;
  keyName: string;
  openAICompatible: boolean;
}

export const PROVIDERS: ProviderMeta[] = [
  { id: "mock", label: "Mock (no key)", defaultModel: "mock-1", keyName: "", openAICompatible: false },
  { id: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini", keyName: "OpenAI API key", openAICompatible: true },
  { id: "openrouter", label: "OpenRouter (any model)", defaultModel: "meta-llama/llama-3.3-70b-instruct", keyName: "OpenRouter key", openAICompatible: true },
  { id: "groq", label: "Groq", defaultModel: "openai/gpt-oss-20b", keyName: "Groq key", openAICompatible: true },
  { id: "mistral", label: "Mistral", defaultModel: "mistral-large-latest", keyName: "Mistral key", openAICompatible: true },
  { id: "nim", label: "NVIDIA NIM", defaultModel: "openai/gpt-oss-20b", keyName: "NIM key", openAICompatible: true },
  { id: "anthropic", label: "Anthropic", defaultModel: "claude-sonnet-4-20250514", keyName: "Anthropic key", openAICompatible: false },
  { id: "gemini", label: "Google Gemini", defaultModel: "gemini-2.0-flash", keyName: "Gemini key", openAICompatible: false },
  { id: "ollama", label: "Ollama (local)", defaultModel: "llama3.1", keyName: "no key needed", openAICompatible: true },
  { id: "custom", label: "Custom OpenAI-compatible", defaultModel: "", keyName: "API key", openAICompatible: true },
];

const BASE_URLS: Partial<Record<AIProviderId, string>> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  nim: "https://integrate.api.nvidia.com/v1",
  ollama: "http://localhost:11434/v1",
};

/** Site-wide keys: every platform reads its key from env (see .env.example).
 *  Null = this provider never takes a key (Mock, local Ollama). */
export const ENV_KEY_FOR: Record<AIProviderId, string | null> = {
  mock: null,
  openai: "VITE_OPENAI_API_KEY",
  anthropic: "VITE_ANTHROPIC_API_KEY",
  gemini: "VITE_GEMINI_API_KEY",
  openrouter: "VITE_OPENROUTER_API_KEY",
  groq: "VITE_GROQ_API_KEY",
  mistral: "VITE_MISTRAL_API_KEY",
  nim: "VITE_NIM_API_KEY",
  ollama: null,
  custom: "VITE_CUSTOM_API_KEY",
};

/** Optional site-wide endpoint overrides (Ollama host, custom gateway, …). */
const ENV_BASE_FOR: Record<AIProviderId, string | null> = {
  mock: null,
  openai: "VITE_OPENAI_BASE_URL",
  anthropic: null,
  gemini: null,
  openrouter: "VITE_OPENROUTER_BASE_URL",
  groq: "VITE_GROQ_BASE_URL",
  mistral: "VITE_MISTRAL_BASE_URL",
  nim: "VITE_NIM_BASE_URL",
  ollama: "VITE_OLLAMA_BASE_URL",
  custom: "VITE_CUSTOM_BASE_URL",
};

/** Read one env var — explicit runtime env first, Vite-embedded env second.
 *  A runtime value (even "") wins, so tests/hosts can clear build-time values. */
function readEnv(name: string): string {
  try {
    const env = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    if (env && name in env) return (env[name] ?? "").trim();
  } catch {
    /* no process env — fall through */
  }
  try {
    const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const v = meta?.[name];
    if (typeof v === "string" && v.length > 0) return v;
  } catch {
    /* not a Vite runtime */
  }
  return "";
}

/** Site keys for a provider: base var plus numbered spares
 *  (`VITE_GROQ_API_KEY`, `VITE_GROQ_API_KEY_2`, …`_5`). Pure. */
export function envApiKeysFor(provider: AIProviderId): string[] {
  const name = ENV_KEY_FOR[provider];
  if (!name) return [];
  const out: string[] = [];
  for (const n of [name, `${name}_2`, `${name}_3`, `${name}_4`, `${name}_5`]) {
    const v = readEnv(n).trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** First site key ("" when the host configured none). Pure. */
export function envApiKeyFor(provider: AIProviderId): string {
  return envApiKeysFor(provider)[0] ?? "";
}

/** Site endpoint override for a provider ("" when none). Pure. */
export function envBaseUrlFor(provider: AIProviderId): string {
  const name = ENV_BASE_FOR[provider];
  return name ? readEnv(name).trim().replace(/\/$/, "") : "";
}

/** Providers that can compile without any key. Pure. */
export function providerNeedsKey(provider: AIProviderId): boolean {
  return provider !== "mock" && provider !== "ollama";
}

/** Effective key: system site key, or the explorer's own key. Pure. */
export function effectiveApiKey(cfg: Pick<AIConfig, "provider" | "apiKey" | "keySource">): string {
  if (cfg.keySource === "custom") return cfg.apiKey.trim();
  return envApiKeyFor(cfg.provider);
}

/** Every usable key in try-order: all site spares, or the single own key. Pure. */
export function effectiveApiKeys(cfg: Pick<AIConfig, "provider" | "apiKey" | "keySource">): string[] {
  if (cfg.keySource === "custom") {
    const own = cfg.apiKey.trim();
    return own ? [own] : [];
  }
  return envApiKeysFor(cfg.provider);
}

/** True when this config can call its provider right now. Pure. */
export function hasUsableKey(cfg: Pick<AIConfig, "provider" | "apiKey" | "keySource">): boolean {
  return !providerNeedsKey(cfg.provider) || effectiveApiKey(cfg).length > 0;
}

/** True when the explorer must add their own key before compiling stories. */
export function needsAiKey(cfg?: Pick<AIConfig, "provider" | "apiKey" | "keySource">): boolean {
  return !hasUsableKey(cfg ?? loadAIConfig());
}

const AI_KEY = "lumen-ai-v1";

/** Storage scope: keys are per-explorer AND per online/offline mode, so one
 *  machine can hold a guest-offline key next to a signed-in online key. */
export interface AiScope {
  owner: string;
  mode: "offline" | "online";
}

export function currentAiScope(): AiScope {
  let owner = "guest";
  let mode: AiScope["mode"] = "offline";
  try {
    owner = loadSession()?.email?.trim() || "guest";
  } catch {
    /* headless — guest */
  }
  try {
    mode = loadEntryChoice() ?? "offline";
  } catch {
    /* headless — offline */
  }
  return { owner, mode };
}

export function aiKeyFor(owner: string, mode: AiScope["mode"]): string {
  const safe = owner.trim().toLowerCase().replace(/[^a-z0-9@._-]+/g, "_").slice(0, 80) || "guest";
  return `${AI_KEY}:${safe}:${mode}`;
}

function parseStored(raw: string | null): AIConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AIConfig>;
    if (!parsed || typeof parsed !== "object") return null;
    const hadSource = typeof parsed.keySource === "string";
    const cfg: AIConfig = { provider: "mock", apiKey: "", model: "mock-1", keySource: "system", ...(parsed as Partial<AIConfig>) };
    if (cfg.keySource !== "custom" && cfg.keySource !== "system") cfg.keySource = "system";
    // pre-toggle configs that carried their own key keep using it
    if (!hadSource && cfg.apiKey.trim() && providerNeedsKey(cfg.provider)) cfg.keySource = "custom";
    return cfg;
  } catch {
    return null;
  }
}

function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function loadAIConfig(owner?: string, mode?: AiScope["mode"]): AIConfig {
  const scope: AiScope =
    owner !== undefined || mode !== undefined
      ? { owner: owner ?? currentAiScope().owner, mode: mode ?? currentAiScope().mode }
      : currentAiScope();
  // 1) this explorer's own config (this mode)
  const scoped = parseStored(readStore(aiKeyFor(scope.owner, scope.mode)));
  if (scoped) return scoped;
  // 2) legacy global config — adopt it into this scope once, then it is theirs
  const legacy = parseStored(readStore(AI_KEY));
  if (legacy) {
    writeStore(aiKeyFor(scope.owner, scope.mode), JSON.stringify(legacy));
    return legacy;
  }
  // 3) site default (host picks the director in env; explorer still needs no UI visit)
  const fallback = readEnv("VITE_AI_DEFAULT_PROVIDER").trim().toLowerCase();
  const ids = PROVIDERS.map((p) => p.id);
  const provider = (ids.includes(fallback as AIProviderId) ? fallback : "mock") as AIProviderId;
  const envModel = readEnv("VITE_AI_DEFAULT_MODEL").trim();
  return {
    provider,
    apiKey: "",
    model: envModel || PROVIDERS.find((p) => p.id === provider)?.defaultModel || "mock-1",
    keySource: "system",
  };
}

export function saveAIConfig(c: AIConfig, owner?: string, mode?: AiScope["mode"]): void {
  const scope: AiScope =
    owner !== undefined || mode !== undefined
      ? { owner: owner ?? currentAiScope().owner, mode: mode ?? currentAiScope().mode }
      : currentAiScope();
  writeStore(aiKeyFor(scope.owner, scope.mode), JSON.stringify(c));
}

export function endpointFor(cfg: AIConfig): string {
  const custom = (cfg.baseUrl ?? "").trim().replace(/\/$/, "");
  if (custom) return custom;
  const envBase = envBaseUrlFor(cfg.provider);
  if (envBase) return envBase;
  return BASE_URLS[cfg.provider] ?? "";
}

/** System contract: JSON-only world compiler brief. Pure — tested. */
export function buildWorldPrompt(input: WorldGenerationInput): { system: string; user: string } {
  const system = [
    "You are Mythio's world compiler. Output ONLY a single JSON object — no prose, no fences. (Reply in json.)",
    "Copy every enum EXACTLY as listed — invented values are rejected. Conditions are always OBJECTS like {type:'all',conditions:[]} — never strings, never missing.",
    "Shape: {id, ownerId:'ai-director', name, slug, description, theme(mars|space|ocean|forest|fantasy|cyberpunk|ancient_ruins|desert|horror|post_apocalyptic|custom), status:'draft', visibility:'private', difficulty(beginner|easy|medium|hard|expert), version:1,",
    "environment:{type(same 11 theme ids),skyColor hex,fogColor hex,primaryColor hex,secondaryColor hex,gravity number,atmosphere(normal|thin|underwater|none),weather(clear|rain|snow|fog|dust_storm|storm|none),timeOfDay(day|night|sunset|dynamic),terrainSeed int,ambientIntensity 0..1},",
    "Dress the palette to the theme (never default red dust): ocean→deep blues + teal fog, forest→greens + mist, desert→sand + heat haze, mars→rust red, space→near-black + violet nebula, horror→ash grey + blood-red fog, fantasy→teal + violet, cyberpunk→neon blue + magenta, ancient_ruins→sandstone + gold dusk, post_apocalyptic→grey-brown + ember orange, custom→fit the brief.",
    "Road/city/driving/highway stories are cyberpunk (neon streets) or custom — NEVER mars, desert or post_apocalyptic.",
    "story:{title,premise,background,centralConflict,playerRole,knownFacts[3 strings],hiddenTruths[2 strings],tone(peaceful|mysterious|dark|adventurous|humorous|epic),canonicalEnding},",
    "locations[]:{id,name,description,position[x,y,z within ±55],radius positive,locked boolean,tags[]}, objects[]:{id,type(building|door|terminal|resource_node|vehicle|artifact|note|map|portal|npc|container|machine|landmark|crystal|creature),modelId(console|solar|rover|hatch|beacon|drone|locker|core|helmet|recorder|glyphwall|maptable|skychime|scrap|campfire|tent|tree|torch|crystal|road|streetlamp|trafficlight|bench|trashbin|mailbox|hydrant|busstop|car|truck|bus|motorcycle|bicycle|boat|house|bed|table|chair|sofa|floorlamp|bookshelf|tv|fridge|desk|watercooler|printer|bush|flower|cactus|palmtree|pond|fountain|statue|billboard|windmill|watertower|gaspump|barrel|ladder|telescope|radio|phonebooth — EXACT catalog id, never invented; match the brief to the MODEL CATALOG lines below),name,description,locationId,position,rotation[0,0,0],scale[1,1,1],interaction{kind(inspect|collect|solve|talk|activate|repair|build),prompt},visibility(visible|hidden|locked)},",
    "MODEL CATALOG — every object modelId MUST be one of these exact ids (unknown ids render as a crate):",
    "mission gear: console (control desk), solar (panel array), rover (Mars rover), hatch (sealed door), beacon (signal fire), drone (hover bot), locker (gear cabinet), core (reactor), helmet, recorder (audio log), glyphwall (rune wall), maptable, skychime, scrap (salvage heap), campfire, tent, tree, torch, crystal (glowing cluster).",
    "streets & rides — for ANY road/city/driving brief: road (asphalt + curbs + lane lines + zebra crossing), streetlamp (glowing lamp), trafficlight (cycles red/amber/green), busstop (shelter + bench), car, truck, bus, motorcycle, bicycle, bench, trashbin, mailbox, hydrant, gaspump (fuel station).",
    "homes & interiors: house (door + lit windows + chimney), bed, table, chair, sofa, floorlamp, bookshelf, tv, fridge, desk, watercooler, printer, boat.",
    "nature & cities: building (multi-story tower, lit windows, roof beacon), bush, flower, cactus, palmtree, pond, fountain, statue, billboard, windmill, watertower, barrel, ladder, telescope, radio, phonebooth.",
    "metro & stations: train (metro carriage), rails (twin track + sleepers), platform (slab + canopy + bench), ticketgate (posts + barrier arm), tunnel (portal mouth), stationsign (glowing board).",
    "heroes & powers: hero (caped champion figure — mentor, guardian, rival), powerup (floating ability orb — grants power items when collected).",
    "market & people: shop (market stall with striped awning + goods — butcher, grocer, vendor of any trade), plus name people plainly (shopkeeper, vendor, guard, traveler) and they arrive as talking characters.",
    "RULE: every street scene gets road + streetlamp + at least one ride (car/bus/truck); every city scene gets building + billboard; homes get house + furniture. Repeat models across locations for avenues and fleets.",
    "DENSITY — no empty ground: place ≥12 objects total, ≥2 objects in EVERY location, spread out (no two objects within 2 units unless a set piece). Space skies get scattered rocks + beacons; streets get lamps + rides along the full avenue; stations get signs + benches.",
    "PICKUPS THAT WORK — every collect_item/deliver_item objective needs real pickups: the granting object MUST carry interaction {kind:'collect', givesItemId (the EXACT item id), givesQuantity:1, prompt}. collect quantity N → place N SEPARATE resource_node objects (one pickup each, never one node granting N). Name nodes after their item ('Fire Crystal shard' grants fire_crystal).",
    "ROAD LAYOUT — roads must form ONE continuous avenue, never scattered slabs: place every road modelId on the SAME x coordinate (x=0), with z centers spaced exactly 6 apart (e.g. -12, -6, 0, 6, 12), rotation [0,0,0], scale [1,1,1]. Line streetlamps and trafficlights at x=-3.2 and x=3.2 using the same z centers. Face buildings at x=±8. COMPLETENESS: a street tale MUST include ≥3 road + ≥3 streetlamp + ≥1 trafficlight + ≥2 rides + ≥1 building — a road prompt with missing pieces is rejected.",
    "METRO LAYOUT — a metro station is ONE connected line, never scattered props: rails on x=0 with z centers spaced exactly 6 apart (the track), platforms at x=±4.5 facing the rails, ticketgates in a row at the concourse end (z = lowest platform z - 8), stationsigns on every platform, tunnels capping the track ends (z = ±(last rail z + 8)). Trains sit ON rails (same x/z, y=0.35). COMPLETENESS: a metro tale MUST include ≥2 rails + ≥1 platform + ≥2 ticketgate + ≥1 train + ≥1 tunnel + ≥1 stationsign. Gate missions with item_owned (ticket) and puzzle_solved (timetable) conditions so Concourse → Gates → Platform → Train → Tunnel unlocks in order.",
    "HEROES & POWERS — for superhero tales, file powers as resource items (flight_cell, strength_serum, blast_core — category energy) placed inside powerup orbs with collect interactions. Structure every hero tale: Origin (collect the first power) → Trials (2 missions spending powers via prerequisites) → Villain lair (locked location, puzzle_condition) → Finale (multi-objective showdown). Name NPC allies and rivals plainly (mentor, inventor, guardian, warlord) with the hero modelId. Showdowns play out as missions + puzzles + repairs — never unwinnable, always hinted.",
    "characters[]:{id,name,role,dialogue[string],locationId},resources[]:{id,name,description,category(material|energy|tool|key_item|food|oxygen|currency),stackable boolean,maxStack int},",
    "missions[]:{id,title,description,type(investigation|collection|construction|repair|exploration|puzzle|rescue|survival|delivery|conversation|discovery),order,difficulty(beginner|easy|medium|hard|expert),prerequisites[] (condition objects only, e.g. {type:'item_owned',itemId,quantity} — empty array when none),objectives[]{id,type(collect_item|reach_location|inspect_object|solve_puzzle|repair_object|build_structure|talk_to_npc|activate_machine|discover_clue|deliver_item|survive_event),description,optional boolean} min 1,rewards[] ({itemId,quantity} objects, never strings),startCondition{type:'all',conditions:[]},completionCondition{type:'all',conditions:[{type:'item_owned',itemId,quantity}]} (real condition object),hidden:false,optional:false,estimatedMinutes},",
    "Condition field rules (missing fields are REJECTED): item_owned needs {itemId,quantity number 1+}; mission_completed needs {missionId}; clue_discovered needs {clueId}; object_inspected needs {objectId}; puzzle_solved needs {puzzleId}; location_reached needs {locationId}; flag_equals needs {key,value}; all/any need {conditions:[...]}; not needs {condition}. Example: {type:'all',conditions:[{type:'item_owned',itemId:'metal',quantity:2}]}.",
    "clues[]:{id,title,text,type(note|symbol|audio|visual|object|dialogue|map|environmental|code|pattern|coordinate),locationId,discoveryMethod(inspect|collect|solve|talk|observe|activate|combine),visibility(visible|hidden|locked|requires_item|requires_mission),importance(minor|normal|critical),misleading:false,optional},",
    "clueConnections[]:{fromClueId,toClueId,relation(reveals|points_to|unlocks|combines_with|explains|contradicts|misdirects)},puzzles[]:{id,title,description,type(sequence|logic|code|symbol|circuit|map|dialogue|resource|spatial|observation),difficulty,locationId,relatedClueIds[],inputs[{id,label,kind(text|choice|sequence)}],hints[{order,text}],rewards[] (same {itemId,quantity} objects),solutionHash('hash:'+lowercase solution),solution},",
    "endings[]:{id,title,description,condition{type:'all',conditions:[]},secret:false}, permissions(all false except allowVisitors true, contributionMode 'approval_required'), settings:{sprintEnabled:true,worldBounds:60},",
    "branding:{station:'SHORT BASE NAME, ≤18 chars, named for THIS story — never AURORA BASE unless Mars',sol:'mission clock like SOL 443',tagline:'≤80 chars, story hook + case file no.'},",
    "createdAt/updatedAt ISO now}.",
    "Rules: ids unique; every locationId/objectId/missionId/clueId/puzzleId/itemId referenced MUST exist; coordinates within ±55; keep it tight and playable.",
  ].join("\n");
  const user = [
    `Brief: ${input.prompt}`,
    `Difficulty: ${input.difficulty}. Missions: ${input.missionCount}. Clue density: ${input.clueDensity}. Puzzle intensity: ${input.puzzleIntensity}.`,
    `Construction allowed: ${input.allowConstruction}. Player contributions: ${input.allowPlayerContributions}.`,
  ].join("\n");
  return { system, user };
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fence ? fence[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The model didn't return JSON — retry or use Mock.");
  return raw.slice(start, end + 1);
}

interface KeyedError {
  status?: number;
  network?: boolean;
}

function httpError(status: number): Error {
  let message: string;
  if (status === 429) message = "Provider is rate-limited right now — wait a minute, or use Mock.";
  else if (status === 401 || status === 403) message = "Provider refused the key (401/403) — check the API key, or use Mock.";
  else if (status === 404) message = "Model not found (404) — that model id is retired; pick a live one, or use Mock.";
  else message = `Provider refused (${status}) — check key/model, or use Mock.`;
  return Object.assign(new Error(message), { status } satisfies KeyedError);
}

function networkError(): Error {
  return Object.assign(new Error("Provider unreachable (network) — retry, or use Mock."), { network: true } satisfies KeyedError);
}

/** Try each key in order: 429 / bad key / 5xx / network roll to the next spare.
 *  Bad requests (400/404) abort — another key won't help. */
async function withKeyFailover<T>(keys: string[], attempt: (key: string) => Promise<T>): Promise<T> {
  const errors: string[] = [];
  for (const key of keys) {
    try {
      return await attempt(key);
    } catch (e) {
      const err = e as KeyedError & { message?: string };
      errors.push(err?.message ?? "request failed");
      const s = err?.status;
      if (!(err?.network || s === 429 || s === 401 || s === 403 || (typeof s === "number" && s >= 500))) break;
    }
  }
  throw new Error(errors[errors.length - 1] ?? "All keys failed — retry, or use Mock.");
}

async function chatOpenAI(base: string, keys: string[], model: string, system: string, user: string, jsonMode: boolean, maxTokens?: number, reasoningEffort?: string): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.7,
  };
  if (jsonMode) body.response_format = { type: "json_object" };
  // world plans are huge — don't let the provider truncate mid-object.
  // Caps differ per cloud (Groq 413s past 8k); local/custom endpoints get
  // no cap at all: many reject unknown fields.
  if (maxTokens !== undefined) body.max_tokens = maxTokens;
  // reasoning models burn the token budget thinking — keep it low so the
  // tale itself fits (gpt-oss family on Groq/NIM).
  if (reasoningEffort !== undefined) body.reasoning_effort = reasoningEffort;
  return withKeyFailover(keys, async (key) => {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    }).catch(() => {
      throw networkError();
    });
    if (!res.ok) throw httpError(res.status);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty reply from provider — retry or use Mock.");
    return content;
  });
}

async function chatAnthropic(keys: string[], model: string, system: string, user: string): Promise<string> {
  return withKeyFailover(keys, async (key) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model, max_tokens: 8000, system, messages: [{ role: "user", content: user }] }),
    }).catch(() => {
      throw networkError();
    });
    if (!res.ok) throw httpError(res.status);
    const data = (await res.json()) as { content?: { text?: string }[] };
    const text = data.content?.map((b) => b.text ?? "").join("");
    if (!text) throw new Error("Empty reply from Anthropic — retry or use Mock.");
    return text;
  });
}

async function chatGemini(keys: string[], model: string, system: string, user: string): Promise<string> {
  return withKeyFailover(keys, async (key) => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }] }),
    }).catch(() => {
      throw networkError();
    });
    if (!res.ok) throw httpError(res.status);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) throw new Error("Empty reply from Gemini — retry or use Mock.");
    return text;
  });
}

/** Fill the small booleans/arrays models drop (hidden, optional, locked,
 *  tags, rewards…) with the contract's own defaults before the strict check.
 *  Pure — never invents content, only the stated defaults. */
export function repairWorldShape(parsed: unknown): void {
  if (!parsed || typeof parsed !== "object") return;
  coerceIdStrings(parsed);
  const w = parsed as {
    missions?: Array<Record<string, unknown>>;
    clues?: Array<Record<string, unknown>>;
    locations?: Array<Record<string, unknown>>;
    resources?: Array<Record<string, unknown>>;
    endings?: Array<Record<string, unknown>>;
    clueConnections?: Array<Record<string, unknown>>;
    permissions?: Record<string, unknown>;
    settings?: Record<string, unknown> | null;
  };
  const list = (v: unknown): Array<Record<string, unknown>> => (Array.isArray(v) ? (v as Array<Record<string, unknown>>) : []);
  // every enum the model likes to paraphrase — map or fall back (defined
  // first: everything below uses these)
  const asEnum = (v: unknown, valid: string[], aliases: Record<string, string>, fallback: string): string => {
    const s = String(v ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
    if (valid.includes(s)) return s;
    if (aliases[s]) return aliases[s];
    return fallback;
  };
  const locIds = new Set(list(w.locations).map((l) => String(l.id)));
  const firstLoc = String(list(w.locations)[0]?.id ?? "loc_landing");
  const validLoc = (v: unknown): string => (typeof v === "string" && locIds.has(v) ? v : firstLoc);
  for (const m of list(w.missions)) {
    if (typeof m.hidden !== "boolean") m.hidden = false;
    if (typeof m.optional !== "boolean") m.optional = false;
    if (!Array.isArray(m.prerequisites)) m.prerequisites = [];
    if (!Array.isArray(m.rewards)) m.rewards = [];
    if (typeof m.title !== "string" || !m.title) m.title = "Unmarked mission";
    if (typeof m.description !== "string") m.description = "";
    m.type = asEnum(m.type, ["investigation", "collection", "construction", "repair", "exploration", "puzzle", "rescue", "survival", "delivery", "conversation", "discovery"], {}, "exploration");
    m.difficulty = asEnum(m.difficulty, DIFFICULTIES, DIFFICULTY_ALIASES, "medium");
    if (typeof m.estimatedMinutes !== "number") m.estimatedMinutes = 5;
    for (const o of list(m.objectives)) {
      if (typeof o.optional !== "boolean") o.optional = false;
    }
  }
  for (const c of list(w.clues)) {
    if (typeof c.misleading !== "boolean") c.misleading = false;
    if (typeof c.optional !== "boolean") c.optional = false;
    if (typeof c.importance === "string") {
      const k = c.importance.toLowerCase().trim();
      if (!["minor", "normal", "critical"].includes(k)) c.importance = IMPORTANCE_ALIASES[k] ?? "normal";
    }
    if (typeof c.title !== "string" || !c.title) c.title = "Unmarked clue";
    if (typeof c.text !== "string") c.text = "";
    c.type = asEnum(c.type, CLUE_TYPES, {}, "note");
    c.discoveryMethod = asEnum(c.discoveryMethod, DISCOVERY_METHODS, {}, "observe");
    if (typeof c.visibility !== "string" || !VISIBILITIES.includes(c.visibility)) c.visibility = "visible";
    c.locationId = validLoc(c.locationId);
  }
  for (const l of list(w.locations)) {
    if (typeof l.locked !== "boolean") l.locked = false;
    if (!Array.isArray(l.tags)) l.tags = [];
  }
  // critical clues must never sit in a locked room with no way in:
  // relocate them to the first open site (unlocking it if none is open)
  const locs = list(w.locations);
  let open = locs.find((l) => l.locked === false);
  if (!open && locs.length > 0) {
    locs[0].locked = false;
    delete locs[0].unlockCondition;
    open = locs[0];
  }
  if (open && typeof open.id === "string") {
    const sealed = new Set(
      locs.filter((l) => l.locked === true && l.unlockCondition === undefined).map((l) => String(l.id)),
    );
    for (const c of list(w.clues)) {
      if (c.importance === "critical" && typeof c.locationId === "string" && sealed.has(c.locationId)) {
        c.locationId = open.id as string;
      }
    }
  }
  for (const r of list(w.resources)) {
    if (typeof r.stackable !== "boolean") r.stackable = true;
    if (typeof r.maxStack !== "number" || r.maxStack < 1) r.maxStack = 99;
    if (typeof r.name !== "string" || !r.name) r.name = "Supply";
    if (typeof r.description !== "string") r.description = "";
    r.category = asEnum(r.category, ["material", "energy", "tool", "key_item", "food", "oxygen", "currency"], {}, "material");
  }
  for (const e of list(w.endings)) {
    if (typeof e.secret !== "boolean") e.secret = false;
  }
  if (w.permissions && typeof w.permissions === "object") {
    for (const k of ["allowVisitors", "allowClueCreation", "allowBuilding", "allowMissionCreation", "allowStoryChanges"]) {
      if (typeof w.permissions[k] !== "boolean") w.permissions[k] = k === "allowVisitors";
    }
  }
  if (w.settings && typeof w.settings === "object" && typeof w.settings.sprintEnabled !== "boolean") {
    w.settings.sprintEnabled = true;
  }
  for (const p of list((w as { puzzles?: unknown }).puzzles)) {
    for (const i of list(p.inputs)) {
      if (typeof i.kind !== "string" || !INPUT_KINDS.includes(i.kind)) i.kind = "text";
    }
    if (!Array.isArray(p.inputs)) p.inputs = [];
    if (!Array.isArray(p.hints)) p.hints = [];
    if (!Array.isArray(p.rewards)) p.rewards = [];
    if (!Array.isArray(p.relatedClueIds)) p.relatedClueIds = [];
    p.type = asEnum(p.type, PUZZLE_TYPES, {}, "sequence");
    p.difficulty = asEnum(p.difficulty, DIFFICULTIES, DIFFICULTY_ALIASES, "medium");
    p.locationId = validLoc(p.locationId);
    if (typeof p.title !== "string" || !p.title) p.title = "Unmarked puzzle";
    if (typeof p.description !== "string") p.description = "";
    if (typeof p.solutionHash !== "string" || !p.solutionHash) {
      p.solutionHash = typeof p.solution === "string" && p.solution ? `hash:${p.solution.toLowerCase()}` : "hash:open";
    }
    p.hints = list(p.hints).map((h, idx) => ({
      order: typeof h.order === "number" && Number.isInteger(h.order) ? h.order : idx + 1,
      text: typeof h.text === "string" ? h.text : "",
    }));
  }
  for (const ch of list((w as { characters?: unknown }).characters)) {
    if (!Array.isArray(ch.dialogue)) ch.dialogue = [];
    if (typeof ch.role !== "string") ch.role = "";
    if (typeof ch.name !== "string" || !ch.name) ch.name = "Unknown voice";
    ch.locationId = validLoc(ch.locationId);
  }
  // branding lengths the contract caps
  const b = (w as { branding?: Record<string, unknown> }).branding;
  if (b && typeof b === "object") {
    if (typeof b.station === "string") b.station = b.station.slice(0, 24) || "FIELD BASE";
    if (typeof b.sol === "string") b.sol = b.sol.slice(0, 16) || "SOL 001";
    if (typeof b.tagline === "string") b.tagline = b.tagline.slice(0, 80);
  }
  for (const o of list((w as { objects?: unknown }).objects)) {
    o.type = asEnum(o.type, OBJECT_TYPES, OBJECT_TYPE_ALIASES, "artifact");
    if (typeof o.modelId !== "string" || !MODEL_IDS.includes(o.modelId)) delete o.modelId;
    if (typeof o.name !== "string" || !o.name) o.name = "Unmarked find";
    if (typeof o.description !== "string") o.description = "";
    o.locationId = validLoc(o.locationId);
    const ix = o.interaction as Record<string, unknown> | undefined;
    if (ix && typeof ix === "object") {
      ix.kind = asEnum(ix.kind, INTERACTION_KINDS, {}, "inspect");
    }
    if (typeof o.visibility !== "string" || !["visible", "hidden", "locked"].includes(o.visibility)) o.visibility = "visible";
  }
  // avenue guarantee: near-aligned road slabs snap to one shared x so the
  // avenue reads continuous; true grids (spread > 4) are left alone. Pure.
  {
    const roads = list((w as { objects?: unknown }).objects).filter(
      (o) => o.modelId === "road" && Array.isArray(o.position),
    );
    const xs = roads
      .map((o) => (o.position as unknown[])[0])
      .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    if (xs.length >= 2) {
      const spread = Math.max(...xs) - Math.min(...xs);
      if (spread > 0 && spread <= 4) {
        const mid = xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
        for (const o of roads) {
          (o.position as unknown[])[0] = mid;
        }
      }
    }
  }
  // top-level enums models paraphrase
  const ww = w as Record<string, unknown>;
  if (ww.status !== "draft" && ww.status !== "testing" && ww.status !== "published" && ww.status !== "archived") ww.status = "draft";
  if (ww.visibility !== "public" && ww.visibility !== "unlisted" && ww.visibility !== "private") ww.visibility = "private";
  if (typeof ww.difficulty === "string" && !["beginner", "easy", "medium", "hard", "expert"].includes(ww.difficulty)) {
    ww.difficulty = ({ normal: "medium", average: "medium", easyish: "easy" } as Record<string, string>)[ww.difficulty.toLowerCase()] ?? "medium";
  }
  if (typeof ww.version !== "number" || ww.version < 1) ww.version = 1;
  // environment numbers sometimes arrive as strings
  const env = ww.environment as Record<string, unknown> | undefined;
  if (env && typeof env === "object") {
    for (const k of ["gravity", "terrainSeed", "ambientIntensity"]) {
      if (typeof env[k] === "string" && env[k] !== "" && !Number.isNaN(Number(env[k]))) env[k] = Number(env[k]);
    }
    if (typeof env.ambientIntensity !== "number") env.ambientIntensity = 0.7;
    if (typeof env.terrainSeed !== "number" || !Number.isInteger(env.terrainSeed)) env.terrainSeed = Math.floor(Math.random() * 100000);
    if (typeof env.gravity !== "number") env.gravity = 9.8;
  }
  repairConditions(w as Parameters<typeof repairConditions>[0]);
  const relations = ["reveals", "points_to", "unlocks", "combines_with", "explains", "contradicts", "misdirects"];
  for (const cc of list(w.clueConnections)) {
    if (typeof cc.relation !== "string" || !relations.includes(cc.relation)) cc.relation = "reveals";
  }
}

/** ids are always strings in the contract — models love bare numbers.
 *  Coerce every `id` / `*Id` field so refs resolve. Pure. */
export function coerceIdStrings(node: unknown): void {
  if (Array.isArray(node)) {
    for (const v of node) coerceIdStrings(v);
    return;
  }
  if (!node || typeof node !== "object") return;
  const rec = node as Record<string, unknown>;
  for (const [k, v] of Object.entries(rec)) {
    if ((k === "id" || k.endsWith("Id")) && typeof v === "number") rec[k] = String(v);
    else coerceIdStrings(v);
  }
}

const CONDITION_TYPES = [
  "mission_completed", "clue_discovered", "item_owned", "object_inspected",
  "puzzle_solved", "location_reached", "flag_equals", "all", "any", "not",
];

/** Paraphrased condition types small models invent ("mission_complete",
 *  "collect_item", …) → the contract's exact ids. Pure. */
const CONDITION_TYPE_ALIASES: Record<string, string> = {
  mission_complete: "mission_completed",
  mission_done: "mission_completed",
  complete_mission: "mission_completed",
  mission: "mission_completed",
  clue_found: "clue_discovered",
  discover_clue: "clue_discovered",
  find_clue: "clue_discovered",
  clue: "clue_discovered",
  has_item: "item_owned",
  collect_item: "item_owned",
  own_item: "item_owned",
  get_item: "item_owned",
  item: "item_owned",
  inspect: "object_inspected",
  inspect_object: "object_inspected",
  interact: "object_inspected",
  object: "object_inspected",
  puzzle_complete: "puzzle_solved",
  solve_puzzle: "puzzle_solved",
  puzzle: "puzzle_solved",
  reach_location: "location_reached",
  reach: "location_reached",
  visit: "location_reached",
  location: "location_reached",
  flag: "flag_equals",
};

/** Deep-repair any value into a valid condition object, or null when it is
 *  beyond rescue (strings, unknown types, missing refs). Fixes the exact
 *  breakage small directors ship: paraphrased types, `item` instead of
 *  `itemId`, `count` instead of `quantity`, missing `quantity`, and broken
 *  entries nested inside `all`/`any`/`not`. Pure. */
function repairConditionValue(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const src = v as Record<string, unknown>;
  const rawType = String(src.type ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  const type = CONDITION_TYPES.includes(rawType) ? rawType : CONDITION_TYPE_ALIASES[rawType];
  if (!type) return null;
  const asRef = (val: unknown): string | null => {
    if (typeof val === "number" && Number.isFinite(val)) return String(val);
    if (typeof val === "string" && val.trim()) return val.trim();
    return null;
  };
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const s = asRef(src[k]);
      if (s) return s;
    }
    return null;
  };
  switch (type) {
    case "mission_completed": {
      const id = pick("missionId", "mission", "missionName", "id");
      return id ? { type, missionId: id } : null;
    }
    case "clue_discovered": {
      const id = pick("clueId", "clue", "clueName", "id");
      return id ? { type, clueId: id } : null;
    }
    case "item_owned": {
      const id = pick("itemId", "item", "itemName", "resourceId", "id");
      if (!id) return null;
      let q: unknown = src.quantity ?? src.count ?? src.amount ?? src.qty ?? 1;
      if (typeof q === "string" && q.trim() !== "" && !Number.isNaN(Number(q))) q = Number(q);
      const qty = typeof q === "number" && Number.isFinite(q) ? Math.max(1, Math.floor(q)) : 1;
      return { type, itemId: id, quantity: qty };
    }
    case "object_inspected": {
      const id = pick("objectId", "object", "objectName", "target", "targetId", "id");
      return id ? { type, objectId: id } : null;
    }
    case "puzzle_solved": {
      const id = pick("puzzleId", "puzzle", "puzzleName", "id");
      return id ? { type, puzzleId: id } : null;
    }
    case "location_reached": {
      const id = pick("locationId", "location", "locationName", "place", "id");
      return id ? { type, locationId: id } : null;
    }
    case "flag_equals": {
      const key = pick("key", "flag", "name");
      if (!key) return null;
      const value = src.value ?? src.val ?? true;
      return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? { type, key, value }
        : { type, key, value: true };
    }
    case "all":
    case "any": {
      const raw = Array.isArray(src.conditions) ? src.conditions : src.conditions === undefined ? [] : [src.conditions];
      const conditions = raw
        .map(repairConditionValue)
        .filter((c): c is Record<string, unknown> => c !== null);
      return { type, conditions };
    }
    case "not": {
      const inner = repairConditionValue(src.condition);
      return inner ? { type, condition: inner } : null;
    }
    default:
      return null;
  }
}

/** Drop invented prerequisite entries; reset broken required conditions to
 *  the neutral `{type:'all',conditions:[]}` the contract itself uses. Pure. */
function repairConditions(w: {
  missions?: Array<Record<string, unknown>>;
  endings?: Array<Record<string, unknown>>;
  locations?: Array<Record<string, unknown>>;
}): void {
  const list = (v: unknown): Array<Record<string, unknown>> => (Array.isArray(v) ? (v as Array<Record<string, unknown>>) : []);
  const neutral = () => ({ type: "all", conditions: [] });
  for (const m of list(w.missions)) {
    m.prerequisites = Array.isArray(m.prerequisites)
      ? m.prerequisites.map(repairConditionValue).filter((c): c is Record<string, unknown> => c !== null)
      : [];
    m.startCondition = repairConditionValue(m.startCondition) ?? neutral();
    m.completionCondition = repairConditionValue(m.completionCondition) ?? neutral();
    if (m.failureCondition !== undefined) {
      const fixed = repairConditionValue(m.failureCondition);
      if (fixed) m.failureCondition = fixed;
      else delete m.failureCondition;
    }
  }
  for (const e of list(w.endings)) {
    e.condition = repairConditionValue(e.condition) ?? neutral();
  }
  for (const l of list(w.locations)) {
    if (l.unlockCondition !== undefined) {
      const fixed = repairConditionValue(l.unlockCondition);
      if (fixed) l.unlockCondition = fixed;
      else delete l.unlockCondition;
    }
  }
}

const IMPORTANCE_ALIASES: Record<string, string> = {
  high: "critical", major: "critical", key: "critical", main: "critical",
  medium: "normal", average: "normal", moderate: "normal",
  low: "minor", side: "minor", trivial: "minor",
};

const INPUT_KINDS = ["text", "choice", "sequence"];

const OBJECT_TYPES = ["building", "door", "terminal", "resource_node", "vehicle", "artifact", "note", "map", "portal", "npc", "container", "machine", "landmark", "crystal", "creature"];
const OBJECT_TYPE_ALIASES: Record<string, string> = {
  lighthouse: "building", tower: "building", house: "building", hut: "building", station: "building",
  antenna: "machine", telescope: "machine", generator: "machine", engine: "machine", drill: "machine",
  computer: "terminal", screen: "terminal", console_table: "terminal",
  bed: "container", table: "container", shelf: "container", chest: "container", box: "container", bedroll: "container",
  person: "npc", survivor: "npc", robot: "npc", alien: "creature", animal: "creature", monster: "creature",
  rock: "landmark", statue: "landmark", sign: "landmark", memorial: "landmark",
  plant: "crystal", flower: "crystal", mushroom: "crystal", shard: "crystal",
  tool: "artifact", device: "artifact", item: "artifact", relic: "artifact",
  gate: "door", entrance: "door", exit: "door",
  car: "vehicle", truck: "vehicle", bike: "vehicle",
};
const MODEL_IDS = [
  // mission gear
  "console", "solar", "rover", "hatch", "beacon", "drone", "locker", "core",
  "helmet", "recorder", "glyphwall", "maptable", "skychime", "scrap",
  "campfire", "tent", "tree", "torch", "crystal",
  // streets & rides
  "road", "streetlamp", "trafficlight", "bench", "trashbin", "mailbox",
  "hydrant", "busstop", "car", "truck", "bus", "motorcycle", "bicycle",
  // homes & interiors
  "boat", "house", "bed", "table", "chair", "sofa", "floorlamp", "bookshelf",
  "tv", "fridge", "desk", "watercooler", "printer",
  // nature & cities
  "bush", "flower", "cactus", "palmtree", "pond", "fountain", "statue",
  "billboard", "windmill", "watertower", "gaspump", "barrel", "ladder",
  "telescope", "radio", "phonebooth",
  // metro pack
  "train", "rails", "platform", "ticketgate", "tunnel", "stationsign",
  // market
  "shop",
  // heroes & powers
  "hero", "powerup",
];
const INTERACTION_KINDS = ["inspect", "collect", "solve", "talk", "activate", "repair", "build"];
const CLUE_TYPES = ["note", "symbol", "audio", "visual", "object", "dialogue", "map", "environmental", "code", "pattern", "coordinate"];
const DISCOVERY_METHODS = ["inspect", "collect", "solve", "talk", "observe", "activate", "combine"];
const VISIBILITIES = ["visible", "hidden", "locked", "requires_item", "requires_mission"];
const PUZZLE_TYPES = ["sequence", "logic", "code", "symbol", "circuit", "map", "dialogue", "resource", "spatial", "observation"];
const DIFFICULTIES = ["beginner", "easy", "medium", "hard", "expert"];
const DIFFICULTY_ALIASES: Record<string, string> = { normal: "medium", average: "medium", easyish: "easy", extreme: "expert" };

/** Map the model's paraphrases onto strict theme ids. Pure. */
export function normalizeThemeId(value: unknown): string {
  const v = String(value ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  const ids = ["mars", "space", "ocean", "forest", "fantasy", "cyberpunk", "ancient_ruins", "desert", "horror", "post_apocalyptic", "custom"];
  if (ids.includes(v)) return v;
  const aliases: Record<string, string> = {
    underwater: "ocean", deep_sea: "ocean", sea: "ocean", abyss: "ocean",
    scifi: "space", sci_fi: "space", space_station: "space", galaxy: "space",
    jungle: "forest", woods: "forest", nature: "forest",
    medieval: "fantasy", magic: "fantasy", castle: "fantasy",
    cyber: "cyberpunk", neon: "cyberpunk", city: "cyberpunk",
    ruins: "ancient_ruins", temple: "ancient_ruins", ruin: "ancient_ruins",
    wasteland: "post_apocalyptic", apocalypse: "post_apocalyptic", fallout: "post_apocalyptic",
    red_planet: "mars", martian: "mars",
    haunted: "horror", ghost: "horror", scary: "horror",
  };
  if (aliases[v]) return aliases[v];
  for (const id of ids) {
    if (v.includes(id) || id.includes(v)) return id;
  }
  return String(value ?? "");
}

/** Canonical sky/fog/ground/accent per theme. Models default to red dust
 *  for EVERYTHING (a highway tale paints Mars), so generation enforces the
 *  palette — the 3D scene and the site theme paint straight from these.
 *  `custom` keeps the model's own colors. Pure. */
export const THEME_PALETTES: Record<string, { sky: string; fog: string; primary: string; secondary: string }> = {
  mars: { sky: "#1a0b2e", fog: "#b5533c", primary: "#c1553b", secondary: "#ff6b35" },
  space: { sky: "#02020a", fog: "#1e1b4b", primary: "#1e293b", secondary: "#8b5cf6" },
  ocean: { sky: "#04121f", fog: "#155e75", primary: "#0c4a6e", secondary: "#22d3ee" },
  forest: { sky: "#0a1408", fog: "#4d7c0f", primary: "#3f6212", secondary: "#a3e635" },
  fantasy: { sky: "#120a2e", fog: "#6d28d9", primary: "#1e3a5f", secondary: "#2dd4bf" },
  cyberpunk: { sky: "#0b0620", fog: "#3b2d6e", primary: "#23262f", secondary: "#ec4899" },
  ancient_ruins: { sky: "#2b1a08", fog: "#b98a3b", primary: "#a67c3b", secondary: "#fbbf24" },
  desert: { sky: "#2b1608", fog: "#d99a55", primary: "#c99a5b", secondary: "#f59e0b" },
  horror: { sky: "#0a0a0a", fog: "#7f1d1d", primary: "#3f3f46", secondary: "#ef4444" },
  post_apocalyptic: { sky: "#171310", fog: "#92600a", primary: "#57534e", secondary: "#fb923c" },
};

/** Sync theme + environment.type and paint the canonical palette. Pure. */
export function normalizeEnvironmentForTheme(parsed: unknown): void {
  if (!parsed || typeof parsed !== "object") return;
  const w = parsed as { theme?: unknown; environment?: Record<string, unknown> | null };
  const theme = normalizeThemeId(w.theme);
  if (theme) {
    w.theme = theme;
    if (w.environment && typeof w.environment === "object") {
      w.environment.type = theme;
      const pal = THEME_PALETTES[theme];
      if (pal) {
        w.environment.skyColor = pal.sky;
        w.environment.fogColor = pal.fog;
        w.environment.primaryColor = pal.primary;
        w.environment.secondaryColor = pal.secondary;
      }
    }
  }
}

const STRONG_ROAD_WORDS = ["highway", "traffic", "driving", "street", "crosswalk", "motorway", "freeway", "pedestrian", "taxi"];
const WEAK_ROAD_WORDS = ["road", "drive", "car", "vehicle", "city", "bus", "signal"];
const MARS_WORDS = ["mars", "martian", "colony", "astronaut", "cosmonaut", "rover", "regolith", "olympus", "valles", "sol "];
const BARREN_THEMES = ["mars", "desert", "post_apocalyptic", "space"];

/** Brief-only road signal: one strong road word, or two weak ones, with no
 *  Martian words. Used by the mock path, where the baked base story is
 *  always Mars-flavored and must not veto the brief. Pure. */
export function briefIsRoadTale(briefText: string): boolean {
  const hay = briefText.toLowerCase();
  const strongHit = STRONG_ROAD_WORDS.some((k) => hay.includes(k));
  const weakHits = WEAK_ROAD_WORDS.filter((k) => hay.includes(k)).length;
  return (strongHit || weakHits >= 2) && !MARS_WORDS.some((k) => hay.includes(k));
}

/** A highway tale painted red-dust is a misfiled theme: when the story is
 *  clearly about roads/city/driving and nothing Martian, move it to
 *  cyberpunk (neon streets) before the palette pass. Pure. */
export function retargetRoadTheme(parsed: unknown, briefText: string): void {
  if (!parsed || typeof parsed !== "object") return;
  const w = parsed as {
    theme?: unknown;
    name?: unknown; description?: unknown;
    story?: { premise?: unknown; background?: unknown; centralConflict?: unknown } | null;
  };
  const theme = normalizeThemeId(w.theme);
  // barren themes misfiled for roads — plus `custom` tales wearing a
  // red-dust palette (the model picks custom + Mars colors for highways)
  const retargetable = BARREN_THEMES.includes(theme) || theme === "custom";
  if (!retargetable) return;
  const hay = [
    briefText,
    String(w.name ?? ""),
    String(w.description ?? ""),
    String(w.story?.premise ?? ""),
    String(w.story?.background ?? ""),
    String(w.story?.centralConflict ?? ""),
  ].join("\n").toLowerCase();
  // one strong road word, or two weak ones ("business" alone must not flip a tale)
  const strongHit = STRONG_ROAD_WORDS.some((k) => hay.includes(k));
  const weakHits = WEAK_ROAD_WORDS.filter((k) => hay.includes(k)).length;
  const roadHit = strongHit || weakHits >= 2;
  const marsHit = MARS_WORDS.some((k) => hay.includes(k));
  if (roadHit && !marsHit) w.theme = "cyberpunk";
}

/** Heal an already-saved world: road tales misfiled as Mars get moved to
 *  neon streets and every fixed theme gets its canonical palette. Returns
 *  true when the theme id changed (so callers can tell the explorer). Pure. */
export function healWorldTheme(world: World): boolean {
  const before = normalizeThemeId(world.theme);
  retargetRoadTheme(world, "");
  normalizeEnvironmentForTheme(world);
  return normalizeThemeId(world.theme) !== before;
}

const norm = (s: unknown): string => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Every item the missions ask for must be pickable in the world. Collects
 *  all itemIds needed by collect/deliver objectives + item_owned conditions,
 *  creates any missing resource defs, and wires grant-less `collect`
 *  interactions (or bare resource_nodes) to the matching item — matched by
 *  name ("Fire Crystal" ↔ fire_crystal), so "Collect the Fire Crystal 0/1"
 *  always has something to pick up. Returns the number of objects rewired.
 *  Pure (mutates the passed world). */
export function healCollectGrants(world: World): number {
  const needed = new Map<string, number>();
  const want = (id: unknown, qty: unknown): void => {
    const key = String(id ?? "").trim();
    if (!key) return;
    const q = typeof qty === "number" && Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
    needed.set(key, Math.max(needed.get(key) ?? 0, q));
  };
  for (const m of world.missions ?? []) {
    for (const o of m.objectives ?? []) {
      const oo = o as { type?: string; itemId?: unknown; quantity?: unknown };
      if ((oo.type === "collect_item" || oo.type === "deliver_item") && oo.itemId) want(oo.itemId, oo.quantity);
    }
    const walk = (c: unknown): void => {
      if (!c || typeof c !== "object") return;
      const cc = c as Record<string, unknown>;
      if (cc.type === "item_owned" && cc.itemId) want(cc.itemId, cc.quantity);
      if (Array.isArray(cc.conditions)) cc.conditions.forEach(walk);
      if (cc.condition) walk(cc.condition);
    };
    for (const c of [...(m.prerequisites ?? []), m.startCondition, m.completionCondition]) walk(c);
  }
  if (needed.size === 0) return 0;
  // missing resource defs block validation — file them as plain materials
  const haveRes = new Set((world.resources ?? []).map((r) => r.id));
  for (const id of needed.keys()) {
    if (!haveRes.has(id)) {
      world.resources.push({
        id, name: id.replace(/_/g, " "),
        description: `Salvaged during ${world.name}.`,
        category: "material", stackable: true, maxStack: 99,
      });
    }
  }
  const granted = new Set<string>();
  for (const o of world.objects ?? []) if (o.interaction?.givesItemId) granted.add(o.interaction.givesItemId);
  for (const m of world.missions ?? []) {
    for (const r of [...(m.rewards ?? [])]) if (r.itemId) granted.add(r.itemId);
  }
  let fixed = 0;
  for (const [itemId, qty] of needed) {
    if (granted.has(itemId)) continue;
    // candidates: collect-kind without a grant, then bare resource_nodes —
    // best name match first ("Fire Crystal" before a generic crate)
    const cands = (world.objects ?? []).filter((o) =>
      (o.interaction?.kind === "collect" && !o.interaction.givesItemId) ||
      (o.type === "resource_node" && !o.interaction?.givesItemId),
    );
    const needles = norm(itemId);
    cands.sort((a, b) => {
      const score = (o: typeof a): number => {
        const hay = norm(o.name) + norm(o.id) + norm(o.modelId);
        if (hay.includes(needles) || needles.includes(hay.replace(/^(the|a)/, ""))) return 0;
        if (o.interaction?.kind === "collect") return 1;
        return 2;
      };
      return score(a) - score(b);
    });
    // one pickup node per unit wanted (max 8) so each collected piece vanishes separately
    const nodes = Math.min(Math.max(qty, 1), 8);
    let assigned = 0;
    for (const o of cands) {
      if (assigned >= nodes) break;
      o.interaction = {
        ...(o.interaction ?? {}),
        kind: "collect",
        givesItemId: itemId,
        givesQuantity: 1,
        prompt: o.interaction?.prompt ?? `Collect ${idToLabel(itemId)}`,
      };
      fixed++;
      assigned++;
    }
    // still short? clone the best candidate's spot (or the first site) as extra nodes
    const base = cands[0];
    const home = world.locations[0];
    while (assigned < nodes) {
      const idx = world.objects.length;
      const at = base ? base.position : home ? home.position : [0, 0.5, 0];
      world.objects.push({
        id: `${itemId}_node${idx}`,
        type: "resource_node",
        modelId: base?.modelId ?? "scrap",
        name: `${idToLabel(itemId)} cache`,
        description: `Salvaged ${idToLabel(itemId)}.`,
        locationId: base?.locationId ?? home?.id ?? "loc_landing",
        position: [
          Math.max(-55, Math.min(55, at[0] + 2 + assigned * 2)),
          at[1] ?? 0.5,
          Math.max(-55, Math.min(55, at[2] - 2)),
        ] as [number, number, number],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        interaction: {
          kind: "collect",
          givesItemId: itemId,
          givesQuantity: 1,
          prompt: `Collect ${idToLabel(itemId)}`,
        },
        visibility: "visible",
      });
      fixed++;
      assigned++;
    }
    granted.add(itemId);
  }
  return fixed;
}

function idToLabel(id: string): string {
  return id.replace(/_/g, " ").trim() || id;
}

/** One chat round with any provider — keys rotate on 429/bad-key/5xx so a
 *  spent spare never blocks the tale. Shared by worlds + chapters. */
export async function chatCompletion(
  cfg: AIConfig,
  model: string,
  system: string,
  user: string,
  opts: { jsonMode?: boolean; maxTokens?: number } = {},
): Promise<string> {
  const keys = effectiveApiKeys(cfg);
  if (providerNeedsKey(cfg.provider) && keys.length === 0) {
    throw new Error(cfg.keySource === "custom"
      ? "Add your own API key below to create story (stored only in this browser)."
      : "No system key in env — flip to Custom key or ask the host to set one.");
  }
  const jsonMode = opts.jsonMode ?? false;
  if (cfg.provider === "anthropic") return chatAnthropic(keys, model, system, user);
  if (cfg.provider === "gemini") return chatGemini(keys, model, system, user);
  const base = endpointFor(cfg);
  if (!base) throw new Error("Set the endpoint URL for the custom provider.");
  const reasoningEffort = /gpt-oss/i.test(model) ? "low" : undefined;
  return chatOpenAI(base, keys, model, system, user, jsonMode, opts.maxTokens, reasoningEffort);
}

export interface ChapterDraftInput {
  taleName: string;
  premise: string;
  background: string;
  recentChapters: { title: string; text: string }[];
  kind: ContributionKind;
  /** the explorer's seed idea (or their rough text to polish) */
  idea: string;
}

/** Prompt contract for one continued chapter. Pure — tested. */
export function buildChapterPrompt(input: ChapterDraftInput): { system: string; user: string } {
  const system = [
    "You are Mythio's story continuer. Write ONE continuation for a living game tale.",
    "Output ONLY a single JSON object — no prose, no fences. (Reply in json.)",
    'Shape: {title (≤80 chars, evocative, never "Untitled"), text (10–5000 chars, second person, concrete sights and sounds, no stage directions)}.',
    "Name concrete objects and people plainly (train, platform, ticket gate, shop, shopkeeper, guard) — everything the chapter names by its plain name appears as a real 3D object or a talking character in the game world.",
  ].join("\n");
  const recent = input.recentChapters
    .slice(-3)
    .map((c, i) => `Prior chapter ${i + 1}: ${c.title} — ${c.text.slice(0, 280)}`)
    .join("\n");
  const user = [
    `Tale: ${input.taleName}`,
    `Premise: ${input.premise.slice(0, 500)}`,
    `Canon so far: ${input.background.slice(0, 800)}`,
    recent ? `Continuations so far:\n${recent}` : "Continuations so far: none — this is the first.",
    `Kind wanted: ${input.kind}`,
    `Explorer's idea: ${input.idea}`,
  ].join("\n");
  return { system, user };
}

/** Check + trim a raw chapter draft. Throws readable errors. Pure — tested. */
export function parseChapterDraft(raw: string): { title: string; text: string } {
  let data: unknown;
  try {
    data = JSON.parse(extractJson(raw));
  } catch {
    throw new Error("The AI returned broken text — retry drafting.");
  }
  const d = data as { title?: unknown; text?: unknown };
  const title = typeof d.title === "string" ? d.title : "";
  let text = typeof d.text === "string" ? d.text.replace(/\s+/g, " ").trim() : "";
  if (text.length > 5000) {
    text = text.slice(0, 5000);
    const cut = text.lastIndexOf(" ");
    if (cut > 4000) text = text.slice(0, cut);
  }
  if (text.length < 10) throw new Error("The AI returned too little — retry drafting.");
  return { title: resolveContributionTitle(title, text), text };
}

/** Draft one chapter with the explorer's AI director. Mock polishes locally
 *  (no key). Throws readable errors → UI keeps the explorer's own words. */
export async function draftChapter(cfg: AIConfig, input: ChapterDraftInput): Promise<{ title: string; text: string }> {
  if (!input.idea.trim()) throw new Error("Give the AI an idea first — a line is enough.");
  if (cfg.provider === "mock") {
    const text = input.idea.replace(/\s+/g, " ").trim();
    if (text.length < 10) throw new Error("Give the AI an idea first — a line is enough.");
    return { title: resolveContributionTitle("", text), text: text.slice(0, 5000) };
  }
  const model = cfg.model.trim() || PROVIDERS.find((p) => p.id === cfg.provider)?.defaultModel || "";
  if (!model) throw new Error("Pick a model for this provider.");
  const key = effectiveApiKey(cfg);
  if (providerNeedsKey(cfg.provider) && !key) throw new Error("Add your AI key in Planner → keys first.");
  const { system, user } = buildChapterPrompt(input);
  const raw = await chatCompletion(cfg, model, system, user, { jsonMode: true, maxTokens: 3000 });
  return parseChapterDraft(raw);
}

/** Generate a world with any provider. Mock needs no key. Throws → UI falls back. */
export async function generateWorldPlan(input: WorldGenerationInput, cfg: AIConfig): Promise<World> {
  if (cfg.provider === "mock") return new MockProvider().generateWorldPlan(input);
  const model = cfg.model.trim() || PROVIDERS.find((p) => p.id === cfg.provider)?.defaultModel || "";
  if (!model) throw new Error("Pick a model for this provider.");
  const key = effectiveApiKey(cfg);
  if (providerNeedsKey(cfg.provider) && !key) throw new Error("Add your own API key below to create story (stored only in this browser).");
  const { system, user } = buildWorldPrompt(input);
  // models are stochastic — one automatic retry before giving up to Mock
  // (never retry rate limits: that just burns more quota). The retry carries
  // the validator's field report so the model fixes exactly what broke.
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const retryNote = attempt === 0 || !lastError
        ? ""
        : `\nYour previous output was REJECTED (${lastError}). Fix ONLY those fields, keep everything else identical, and output the FULL JSON again.`;
      return await generateWorldPlanOnce(cfg, model, system, user + retryNote);
    } catch (e) {
      lastError = e instanceof Error ? e.message : "generation failed";
      if (/rate-limited/i.test(lastError)) break;
    }
  }
  throw new Error(lastError || "Generation failed — retry or use Mock.");
}

async function generateWorldPlanOnce(cfg: AIConfig, model: string, system: string, user: string): Promise<World> {
  // response_format:json_object is unreliable on NVIDIA NIM (400s on
  // gpt-oss) — extractJson already strips fences, so plain text is safer.
  const jsonMode = cfg.provider === "openai" || cfg.provider === "openrouter" || cfg.provider === "groq" || cfg.provider === "mistral";
  // per-cloud output ceilings (Groq/Mistral refuse past ~8k)
  const maxTokens = !jsonMode ? undefined : cfg.provider === "groq" || cfg.provider === "mistral" ? 8000 : 16000;
  const raw = await chatCompletion(cfg, model, system, user, { jsonMode, maxTokens });
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new Error("The model returned broken JSON — retry or use Mock.");
  }
  // forgive theme paraphrases ("underwater" → ocean) before the strict check
  if (parsed && typeof parsed === "object") {
    const w = parsed as { theme?: unknown; environment?: { type?: unknown } | null };
    w.theme = normalizeThemeId(w.theme);
    if (w.environment && typeof w.environment === "object") {
      w.environment.type = normalizeThemeId(w.environment.type);
    }
    repairWorldShape(parsed);
    // highway tales misfiled as Mars → neon streets; then paint the canon
    retargetRoadTheme(parsed, user);
    normalizeEnvironmentForTheme(parsed);
    healCollectGrants(parsed as World);
  }
  const checked = worldSchema.safeParse(parsed);
  if (!checked.success) {
    // name the broken fields so the explorer (and logs) see WHAT failed
    const where = checked.error.issues.slice(0, 2).map((i) => {
      const path = i.path.join(".") || "(root)";
      return `${path} (${i.message.slice(0, 80)})`;
    }).join(" · ");
    throw new Error(`The model broke the contract at ${where} — retry or use Mock.`);
  }
  return checked.data as unknown as World;
}
