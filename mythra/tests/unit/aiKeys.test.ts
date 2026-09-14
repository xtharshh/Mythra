import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  aiKeyFor,
  draftChapter,
  effectiveApiKey,
  effectiveApiKeys,
  endpointFor,
  envApiKeyFor,
  envApiKeysFor,
  hasUsableKey,
  loadAIConfig,
  needsAiKey,
  providerNeedsKey,
  saveAIConfig,
} from "../../src/ai/providers";

// node test env has no DOM storage — minimal in-memory stand-in
const mem = new Map<string, string>();

beforeEach(() => {
  mem.clear();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => {
        mem.set(k, String(v));
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    },
    configurable: true,
    writable: true,
  });
  vi.unstubAllEnvs();
  // the dev machine's real .env leaks into import.meta.env under vitest —
  // clear every site key at runtime so tests assert only what they stub
  for (const name of [
    "VITE_OPENAI_API_KEY",
    "VITE_ANTHROPIC_API_KEY",
    "VITE_GEMINI_API_KEY",
    "VITE_OPENROUTER_API_KEY",
    "VITE_GROQ_API_KEY",
    "VITE_GROQ_API_KEY_2",
    "VITE_GROQ_API_KEY_3",
    "VITE_GROQ_API_KEY_4",
    "VITE_GROQ_API_KEY_5",
    "VITE_MISTRAL_API_KEY",
    "VITE_NIM_API_KEY",
    "VITE_NIM_API_KEY_2",
    "VITE_NIM_API_KEY_3",
    "VITE_NIM_API_KEY_4",
    "VITE_NIM_API_KEY_5",
    "VITE_NIM_BASE_URL",
    "VITE_CUSTOM_API_KEY",
    "VITE_OPENAI_BASE_URL",
    "VITE_OPENROUTER_BASE_URL",
    "VITE_GROQ_BASE_URL",
    "VITE_MISTRAL_BASE_URL",
    "VITE_OLLAMA_BASE_URL",
    "VITE_CUSTOM_BASE_URL",
    "VITE_AI_DEFAULT_PROVIDER",
    "VITE_AI_DEFAULT_MODEL",
  ]) {
    vi.stubEnv(name, "");
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("site keys from env (all platforms)", () => {
  it("reads each platform key, empty when the host set none", () => {
    vi.stubEnv("VITE_OPENAI_API_KEY", "sk-site");
    expect(envApiKeyFor("openai")).toBe("sk-site");
    expect(envApiKeyFor("groq")).toBe("");
    expect(envApiKeyFor("mock")).toBe("");
    expect(envApiKeyFor("ollama")).toBe("");
  });

  it("system uses env, custom uses only yours", () => {
    vi.stubEnv("VITE_GROQ_API_KEY", "sk-site");
    expect(effectiveApiKey({ provider: "groq", apiKey: "", keySource: "system" })).toBe("sk-site");
    expect(effectiveApiKey({ provider: "groq", apiKey: "sk-mine", keySource: "system" })).toBe("sk-site");
    expect(effectiveApiKey({ provider: "groq", apiKey: "  sk-mine ", keySource: "custom" })).toBe("sk-mine");
    expect(effectiveApiKey({ provider: "mistral", apiKey: "", keySource: "custom" })).toBe("");
  });

  it("collects numbered spares per platform", () => {
    vi.stubEnv("VITE_GROQ_API_KEY", "sk-a");
    vi.stubEnv("VITE_GROQ_API_KEY_2", "sk-b");
    vi.stubEnv("VITE_GROQ_API_KEY_3", "sk-a"); // dupes collapse
    expect(envApiKeysFor("groq")).toEqual(["sk-a", "sk-b"]);
    expect(effectiveApiKeys({ provider: "groq", apiKey: "", keySource: "system" })).toEqual(["sk-a", "sk-b"]);
    expect(effectiveApiKeys({ provider: "groq", apiKey: "sk-mine", keySource: "custom" })).toEqual(["sk-mine"]);
    expect(effectiveApiKeys({ provider: "groq", apiKey: "", keySource: "custom" })).toEqual([]);
  });

  it("resolves endpoints: own baseUrl > env base > built-in default", () => {
    vi.stubEnv("VITE_OLLAMA_BASE_URL", "http://pi:11434/v1");
    expect(endpointFor({ provider: "ollama", apiKey: "", model: "m", keySource: "system" })).toBe("http://pi:11434/v1");
    expect(
      endpointFor({ provider: "ollama", apiKey: "", model: "m", keySource: "system", baseUrl: "https://mine/v1/" }),
    ).toBe("https://mine/v1");
    expect(endpointFor({ provider: "openai", apiKey: "", model: "x", keySource: "system" })).toContain("openai.com");
  });
});

describe("key gate (redirect to add your own key)", () => {
  it("mock + ollama never need keys; the rest do", () => {
    expect(providerNeedsKey("mock")).toBe(false);
    expect(providerNeedsKey("ollama")).toBe(false);
    expect(providerNeedsKey("openai")).toBe(true);
    expect(providerNeedsKey("custom")).toBe(true);
  });

  it("missing key when neither explorer nor site key exists", () => {
    expect(hasUsableKey({ provider: "openai", apiKey: "", keySource: "custom" })).toBe(false);
    expect(needsAiKey({ provider: "openai", apiKey: "", keySource: "custom" })).toBe(true);
    expect(needsAiKey({ provider: "mock", apiKey: "", keySource: "system" })).toBe(false);
    vi.stubEnv("VITE_OPENAI_API_KEY", "sk-site");
    expect(needsAiKey({ provider: "openai", apiKey: "", keySource: "system" })).toBe(false);
  });

  it("wires NVIDIA NIM like any OpenAI-compatible director", () => {
    vi.stubEnv("VITE_NIM_API_KEY", "nvapi-site");
    expect(envApiKeysFor("nim")).toEqual(["nvapi-site"]);
    expect(providerNeedsKey("nim")).toBe(true);
    expect(hasUsableKey({ provider: "nim", apiKey: "", keySource: "system" })).toBe(true);
    expect(endpointFor({ provider: "nim", apiKey: "", model: "m", keySource: "system" })).toContain("nvidia.com");
  });

  it("rolls to the next spare when one is limited, aborts on bad requests", async () => {
    vi.stubEnv("VITE_GROQ_API_KEY", "sk-one");
    vi.stubEnv("VITE_GROQ_API_KEY_2", "sk-two");
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (_url: unknown, opts?: { headers?: Record<string, string> }) => {
      const auth = opts?.headers?.Authorization ?? "";
      seen.push(auth);
      if (auth.includes("sk-one")) return { ok: false, status: 429 };
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"title":"Tide","text":"The rover headlights flickered twice on the dark ridge line."}' } }] }),
      };
    });
    const d = await draftChapter(
      { provider: "groq", apiKey: "", model: "m", keySource: "system" },
      { taleName: "T", premise: "P", background: "B", recentChapters: [], kind: "note", idea: "seed idea here yes" },
    );
    expect(seen).toEqual(["Bearer sk-one", "Bearer sk-two"]);
    expect(d.text).toContain("flickered");

    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return { ok: false, status: 400 };
    });
    await expect(
      draftChapter(
        { provider: "groq", apiKey: "", model: "m", keySource: "system" },
        { taleName: "T", premise: "P", background: "B", recentChapters: [], kind: "note", idea: "seed idea here yes" },
      ),
    ).rejects.toThrow(/400|refused/);
    expect(calls).toBe(1); // bad request burns no spares
  });
});

describe("per-explorer keys (login × online/offline)", () => {
  it("scopes storage so logins and modes never share keys", () => {
    saveAIConfig({ provider: "openai", apiKey: "sk-alice-online", model: "gpt-4o-mini", keySource: "custom" }, "alice@x.com", "online");
    saveAIConfig({ provider: "groq", apiKey: "sk-alice-offline", model: "llama", keySource: "custom" }, "alice@x.com", "offline");
    expect(loadAIConfig("alice@x.com", "online").apiKey).toBe("sk-alice-online");
    expect(loadAIConfig("alice@x.com", "offline").apiKey).toBe("sk-alice-offline");
    // another explorer (or guest) starts clean — never inherits alice's keys
    expect(loadAIConfig("bob@x.com", "online").provider).toBe("mock");
    expect(loadAIConfig("bob@x.com", "online").apiKey).toBe("");
  });

  it("adopts the legacy global config into the explorer scope once", () => {
    mem.set("lumen-ai-v1", JSON.stringify({ provider: "groq", apiKey: "sk-legacy", model: "llama" }));
    const cfg = loadAIConfig("carol@x.com", "online");
    expect(cfg.apiKey).toBe("sk-legacy");
    // pre-toggle own keys keep working as custom (never silently switched to env)
    expect(cfg.keySource).toBe("custom");
    expect(mem.get(aiKeyFor("carol@x.com", "online"))).toContain("sk-legacy");
  });
});
