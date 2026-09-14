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
    "You are MYTHRA's world compiler. Output ONLY a single JSON object — no prose, no fences. (Reply in json.)",
    "Copy every enum EXACTLY as listed — invented values are rejected. Conditions are always OBJECTS like {type:'all',conditions:[]} — never strings, never missing.",
    "Shape: {id, ownerId:'ai-director', name, slug, description, theme(mars|space|ocean|forest|fantasy|cyberpunk|ancient_ruins|desert|horror|post_apocalyptic|custom), status:'draft', visibility:'private', difficulty(beginner|easy|medium|hard|expert), version:1,",
    "environment:{type(same 11 theme ids),skyColor hex,fogColor hex,primaryColor hex,secondaryColor hex,gravity number,atmosphere(normal|thin|underwater|none),weather(clear|rain|snow|fog|dust_storm|storm|none),timeOfDay(day|night|sunset|dynamic),terrainSeed int,ambientIntensity 0..1},",
    "story:{title,premise,background,centralConflict,playerRole,knownFacts[3 strings],hiddenTruths[2 strings],tone(peaceful|mysterious|dark|adventurous|humorous|epic),canonicalEnding},",
    "locations[]:{id,name,description,position[x,y,z within ±55],radius positive,locked boolean,tags[]}, objects[]:{id,type(building|door|terminal|resource_node|vehicle|artifact|note|map|portal|npc|container|machine|landmark|crystal|creature),modelId(console|solar|rover|hatch|beacon|drone|locker|core|helmet|recorder|glyphwall|maptable|skychime|scrap|campfire|tent|tree|torch|crystal),name,description,locationId,position,rotation[0,0,0],scale[1,1,1],interaction{kind(inspect|collect|solve|talk|activate|repair|build),prompt},visibility(visible|hidden|locked)},",
    "characters[]:{id,name,role,dialogue[string],locationId},resources[]:{id,name,description,category(material|energy|tool|key_item|food|oxygen|currency),stackable boolean,maxStack int},",
    "missions[]:{id,title,description,type(investigation|collection|construction|repair|exploration|puzzle|rescue|survival|delivery|conversation|discovery),order,difficulty(beginner|easy|medium|hard|expert),prerequisites[] (condition objects only, e.g. {type:'item_owned',itemId,quantity} — empty array when none),objectives[]{id,type(collect_item|reach_location|inspect_object|solve_puzzle|repair_object|build_structure|talk_to_npc|activate_machine|discover_clue|deliver_item|survive_event),description,optional boolean} min 1,rewards[] ({itemId,quantity} objects, never strings),startCondition{type:'all',conditions:[]},completionCondition{type:'all',conditions:[{type:'item_owned',itemId,quantity}]} (real condition object),hidden:false,optional:false,estimatedMinutes},",
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
  for (const m of list(w.missions)) {
    if (typeof m.hidden !== "boolean") m.hidden = false;
    if (typeof m.optional !== "boolean") m.optional = false;
    if (!Array.isArray(m.prerequisites)) m.prerequisites = [];
    if (!Array.isArray(m.rewards)) m.rewards = [];
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
  }
  for (const ch of list((w as { characters?: unknown }).characters)) {
    if (!Array.isArray(ch.dialogue)) ch.dialogue = [];
  }
  // branding lengths the contract caps
  const b = (w as { branding?: Record<string, unknown> }).branding;
  if (b && typeof b === "object") {
    if (typeof b.station === "string") b.station = b.station.slice(0, 24) || "FIELD BASE";
    if (typeof b.sol === "string") b.sol = b.sol.slice(0, 16) || "SOL 001";
    if (typeof b.tagline === "string") b.tagline = b.tagline.slice(0, 80);
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

/** A condition object the engine can actually evaluate. Pure. */
function isConditionLike(v: unknown): boolean {
  return !!v && typeof v === "object" && CONDITION_TYPES.includes(String((v as Record<string, unknown>).type ?? ""));
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
    if (Array.isArray(m.prerequisites)) m.prerequisites = m.prerequisites.filter(isConditionLike);
    if (!isConditionLike(m.startCondition)) m.startCondition = neutral();
    if (!isConditionLike(m.completionCondition)) m.completionCondition = neutral();
    if (m.failureCondition !== undefined && !isConditionLike(m.failureCondition)) delete m.failureCondition;
  }
  for (const e of list(w.endings)) {
    if (!isConditionLike(e.condition)) e.condition = neutral();
  }
  for (const l of list(w.locations)) {
    if (l.unlockCondition !== undefined && !isConditionLike(l.unlockCondition)) delete l.unlockCondition;
  }
}

const IMPORTANCE_ALIASES: Record<string, string> = {
  high: "critical", major: "critical", key: "critical", main: "critical",
  medium: "normal", average: "normal", moderate: "normal",
  low: "minor", side: "minor", trivial: "minor",
};

const INPUT_KINDS = ["text", "choice", "sequence"];

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
    "You are MYTHRA's story continuer. Write ONE continuation for a living game tale.",
    "Output ONLY a single JSON object — no prose, no fences. (Reply in json.)",
    'Shape: {title (≤80 chars, evocative, never "Untitled"), text (10–5000 chars, second person, concrete sights and sounds, no stage directions)}.',
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
  // (never retry rate limits: that just burns more quota)
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await generateWorldPlanOnce(cfg, model, system, user);
    } catch (e) {
      lastError = e instanceof Error ? e.message : "generation failed";
      if (/rate-limited/i.test(lastError)) break;
    }
  }
  throw new Error(lastError || "Generation failed — retry or use Mock.");
}

async function generateWorldPlanOnce(cfg: AIConfig, model: string, system: string, user: string): Promise<World> {
  const jsonMode = cfg.provider === "openai" || cfg.provider === "openrouter" || cfg.provider === "groq" || cfg.provider === "mistral" || cfg.provider === "nim";
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
