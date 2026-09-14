// Universal AI providers (skills.md AI-Director): bring ANY key —
// OpenAI, Anthropic, Gemini, OpenRouter, Groq, Mistral, Ollama, custom
// OpenAI-compatible endpoints — or run keyless on Mock. Keys live ONLY in
// localStorage (`lumen-ai-v1`); they are sent to the chosen provider and
// nowhere else. Every output is Zod-checked; failures fall back to Mock.
import { MockProvider } from "./mockProvider";
import { worldSchema } from "../schemas";
import type { World, WorldGenerationInput } from "../types";

export type AIProviderId =
  | "mock" | "openai" | "anthropic" | "gemini" | "openrouter"
  | "groq" | "mistral" | "ollama" | "custom";

export interface AIConfig {
  provider: AIProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
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
  { id: "groq", label: "Groq", defaultModel: "llama-3.3-70b-versatile", keyName: "Groq key", openAICompatible: true },
  { id: "mistral", label: "Mistral", defaultModel: "mistral-large-latest", keyName: "Mistral key", openAICompatible: true },
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
  ollama: "http://localhost:11434/v1",
};

const AI_KEY = "lumen-ai-v1";

export function loadAIConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(AI_KEY);
    if (raw) return { provider: "mock", apiKey: "", model: "mock-1", ...(JSON.parse(raw) as Partial<AIConfig>) };
  } catch {
    /* ignore */
  }
  return { provider: "mock", apiKey: "", model: "mock-1" };
}

export function saveAIConfig(c: AIConfig): void {
  try {
    localStorage.setItem(AI_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

export function endpointFor(cfg: AIConfig): string {
  const custom = (cfg.baseUrl ?? "").trim().replace(/\/$/, "");
  if (custom) return custom;
  return BASE_URLS[cfg.provider] ?? "";
}

/** System contract: JSON-only world compiler brief. Pure — tested. */
export function buildWorldPrompt(input: WorldGenerationInput): { system: string; user: string } {
  const system = [
    "You are MYTHRA's world compiler. Output ONLY a single JSON object — no prose, no fences.",
    "Shape: {id, ownerId:'ai-director', name, slug, description, theme(one of mars|space|ocean|forest|fantasy|cyberpunk|ancient_ruins|desert|horror|post_apocalyptic|custom), status:'draft', visibility:'private', difficulty, version:1,",
    "environment:{type,syyColor hex,fogColor hex,primaryColor hex,secondaryColor hex,gravity,atmosphere(normal|thin|underwater|none),weather(clear|rain|snow|fog|dust_storm|storm|none),timeOfDay(day|night|sunset|dynamic),terrainSeed int,ambientIntensity 0..1},",
    "story:{title,premise,background,centralConflict,playerRole,knownFacts[3],hiddenTruths[2],tone(peaceful|mysterious|dark|adventurous|humorous|epic),canonicalEnding},",
    "locations[]:{id,name,description,position[x,y,z within ±55],radius,locked,tags[]}, objects[]:{id,type(building|door|terminal|resource_node|vehicle|artifact|note|map|portal|npc|container|machine|landmark|crystal|creature),modelId(console|solar|rover|hatch|beacon|drone|locker|core|helmet|recorder|glyphwall|maptable|skychime|scrap|campfire|tent|tree|torch|crystal),name,description,locationId,position,rotation[0,0,0],scale[1,1,1],interaction{kind(inspect|collect|solve|talk|activate|repair|build),prompt},visibility:'visible'},",
    "characters[],resources[]:{id,name,description,category(material|energy|tool|key_item|food|oxygen|currency),stackable,maxStack},",
    "missions[]:{id,title,description,type,order,difficulty,prerequisites[],objectives[]{id,type,description,optional},rewards[],startCondition{type:'all',conditions:[]},completionCondition,hiddn:false,optional:false,estimatedMinutes},",
    "clues[]:{id,title,text,type,locationId,discoveryMethod(inspect|collect|solve|talk|observe|activate|combine),visibility:'visible',importance,misleading:false,optional},",
    "clueConnections[],puzzles[]:{id,title,description,type(sequence|logic|code|symbol|circuit|map|dialogue|resource|spatial|observation),difficulty,locationId,relatedClueIds[],inputs[{id,label,kind}],hints[{order,text}],rewards[],solutionHash('hash:'+lowercase solution),solution},",
    "endings[]:{id,title,description,condition,secret:false}, permissions(all false except allowVisitors true, contributionMode 'approval_required'), settings:{sprintEnabled:true,worldBounds:60},",
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

async function chatOpenAI(base: string, key: string, model: string, system: string, user: string, jsonMode: boolean): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.7,
  };
  if (jsonMode) body.response_format = { type: "json_object" };
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Provider refused (${res.status}) — check key/model, or use Mock.`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty reply from provider — retry or use Mock.");
  return content;
}

async function chatAnthropic(key: string, model: string, system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model, max_tokens: 8000, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic refused (${res.status}) — check key/model, or use Mock.`);
  const data = (await res.json()) as { content?: { text?: string }[] };
  const text = data.content?.map((b) => b.text ?? "").join("");
  if (!text) throw new Error("Empty reply from Anthropic — retry or use Mock.");
  return text;
}

async function chatGemini(key: string, model: string, system: string, user: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini refused (${res.status}) — check key/model, or use Mock.`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new Error("Empty reply from Gemini — retry or use Mock.");
  return text;
}

/** Generate a world with any provider. Mock needs no key. Throws → UI falls back. */
export async function generateWorldPlan(input: WorldGenerationInput, cfg: AIConfig): Promise<World> {
  if (cfg.provider === "mock") return new MockProvider().generateWorldPlan(input);
  const model = cfg.model.trim() || PROVIDERS.find((p) => p.id === cfg.provider)?.defaultModel || "";
  if (!model) throw new Error("Pick a model for this provider.");
  if (cfg.provider !== "ollama" && !cfg.apiKey.trim()) throw new Error("Paste your API key first (stored only in this browser).");
  const { system, user } = buildWorldPrompt(input);
  let raw: string;
  if (cfg.provider === "anthropic") raw = await chatAnthropic(cfg.apiKey.trim(), model, system, user);
  else if (cfg.provider === "gemini") raw = await chatGemini(cfg.apiKey.trim(), model, system, user);
  else {
    const base = endpointFor(cfg);
    if (!base) throw new Error("Set the endpoint URL for the custom provider.");
    const jsonMode = cfg.provider === "openai" || cfg.provider === "openrouter" || cfg.provider === "groq" || cfg.provider === "mistral";
    raw = await chatOpenAI(base, cfg.apiKey.trim(), model, system, user, jsonMode);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new Error("The model returned broken JSON — retry or use Mock.");
  }
  const checked = worldSchema.safeParse(parsed);
  if (!checked.success) {
    throw new Error(`The model broke the contract (${checked.error.issues[0]?.message ?? "invalid world"}) — retry or use Mock.`);
  }
  return checked.data as unknown as World;
}
