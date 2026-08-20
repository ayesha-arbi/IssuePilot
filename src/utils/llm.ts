import OpenAI from "openai";
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";

export interface ModelConfig {
  spec: string;
  provider: string;
  modelName: string;
  apiKeys: string[];
  baseUrl?: string;
}

/**
 * Case-insensitive env var lookup. process.env keys are case-SENSITIVE in Node —
 * a .env file with a differently-cased variable name won't be found by an
 * exact-case lookup. This matters especially since keys get typed/pasted by hand.
 */
function getEnvCaseInsensitive(name: string): string | undefined {
  const target = name.toLowerCase();
  for (const key of Object.keys(process.env)) {
    if (key.toLowerCase() === target) {
      return process.env[key];
    }
  }
  return undefined;
}

/**
 * Extracts all non-empty API keys for a provider from env vars.
 * Supports comma-separated keys (e.g. GROQ_API_KEY="key1,key2")
 * and numbered keys (e.g. GROQ_API_KEY_1, GROQ_API_KEY_2).
 * Case-insensitive on the env var name itself.
 */
export function getApiKeysForProvider(varNames: string[]): string[] {
  const keys: string[] = [];

  for (const name of varNames) {
    const value = getEnvCaseInsensitive(name);
    if (value && typeof value === "string") {
      const split = value.split(",").map((k) => k.trim()).filter(Boolean);
      keys.push(...split);
    }

    // Check indexed variants: NAME_1, NAME_2, NAME_3
    for (let i = 1; i <= 5; i++) {
      const indexed = getEnvCaseInsensitive(`${name}_${i}`);
      if (indexed && typeof indexed === "string" && indexed.trim()) {
        keys.push(indexed.trim());
      }
    }
  }

  return Array.from(new Set(keys));
}

interface ProviderDef {
  prefix: string;
  baseUrl: string;
  envVars: string[];
  defaultModels: string[];
  requiresKey: boolean;
}

export const PROVIDERS: Record<string, ProviderDef> = {
  groq: {
    prefix: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    envVars: ["GROQ_API_KEY"],
    defaultModels: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    requiresKey: true,
  },
  grok: {
    prefix: "grok",
    baseUrl: "https://api.x.ai/v1",
    envVars: ["GROK_API_KEY", "XAI_API_KEY"],
    defaultModels: ["grok-beta", "grok-2-latest"],
    requiresKey: true,
  },
  "github-models": {
    prefix: "github-models",
    baseUrl: "https://models.github.ai/inference",
    envVars: ["GITHUB_MODELS_KEY", "GITHUB_TOKEN"],
    defaultModels: ["gpt-4o-mini"],
    requiresKey: true,
  },
  cerebras: {
    prefix: "cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    envVars: ["CEREBRAS_API_KEY"],
    defaultModels: ["llama3.1-70b", "llama3.1-8b"],
    requiresKey: true,
  },
  together: {
    prefix: "together",
    baseUrl: "https://api.together.xyz/v1",
    envVars: ["TOGETHER_API_KEY"],
    defaultModels: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
    requiresKey: true,
  },
  deepseek: {
    prefix: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    envVars: ["DEEPSEEK_API_KEY"],
    defaultModels: ["deepseek-chat"],
    requiresKey: true,
  },
  mistral: {
    prefix: "mistral",
    baseUrl: "https://api.mistral.ai/v1",
    envVars: ["MISTRAL_API_KEY"],
    defaultModels: ["open-mistral-7b", "mistral-small-latest"],
    requiresKey: true,
  },
  openai: {
    prefix: "openai",
    baseUrl: "https://api.openai.com/v1",
    envVars: ["OPENAI_API_KEY"],
    defaultModels: ["gpt-4o-mini"],
    requiresKey: true,
  },
  openrouter: {
    prefix: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    envVars: ["OPENROUTER_API_KEY"],
    defaultModels: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen-2.5-coder-32b-instruct:free",
      "openrouter/free",
    ],
    requiresKey: true,
  },
  pollinations: {
    prefix: "pollinations",
    baseUrl: "https://text.pollinations.ai/v1",
    envVars: [],
    defaultModels: ["openai", "qwen-coder"],
    requiresKey: false,
  },
};

/**
 * Builds the fallback model chain based on available environment API keys and user preferences.
 */
export function getFallbackModels(customFallbackStr?: string): string[] {
  if (customFallbackStr) {
    return customFallbackStr.split(",").map((s) => s.trim()).filter(Boolean);
  }
  const envFallbacks = getEnvCaseInsensitive("MODEL_FALLBACKS");
  if (envFallbacks) {
    return envFallbacks.split(",").map((s) => s.trim()).filter(Boolean);
  }

  const list: string[] = [];

  for (const [pKey, provider] of Object.entries(PROVIDERS)) {
    if (!provider.requiresKey) continue;
    const keys = getApiKeysForProvider(provider.envVars);
    if (keys.length > 0) {
      for (const m of provider.defaultModels) {
        list.push(`${pKey}/${m}`);
      }
    }
  }

  if (!list.some((m) => m.startsWith("pollinations/"))) {
    list.push("pollinations/openai");
  }

  return list;
}

export function createModelClient(spec: string): ModelConfig {
  const parts = spec.split("/");
  const providerKey = parts[0].toLowerCase();
  const modelName = parts.slice(1).join("/") || "default";

  const provider = PROVIDERS[providerKey];

  if (provider) {
    const keys = provider.requiresKey ? getApiKeysForProvider(provider.envVars) : ["none"];
    return {
      spec,
      provider: providerKey,
      modelName,
      apiKeys: keys.length > 0 ? keys : [],
      baseUrl: provider.baseUrl,
    };
  }

  if (providerKey === "custom") {
    const customKey = getEnvCaseInsensitive("LLM_API_KEY");
    return {
      spec,
      provider: "custom",
      modelName: getEnvCaseInsensitive("LLM_MODEL") || modelName,
      apiKeys: customKey ? [customKey] : [],
      baseUrl: getEnvCaseInsensitive("LLM_BASE_URL") || "http://localhost:11434/v1",
    };
  }

  const keys = getApiKeysForProvider(["OPENROUTER_API_KEY"]);
  return {
    spec,
    provider: "openrouter",
    modelName: spec,
    apiKeys: keys,
    baseUrl: "https://openrouter.ai/api/v1",
  };
}

/**
 * Pulls a human-readable message out of whatever shape the SDK/provider threw.
 * Providers don't all format errors the same way, so this checks several
 * common shapes rather than assuming one.
 */
function extractErrorDetail(err: unknown): string {
  const e = err as any;
  const candidates = [
    e?.error?.message,
    e?.response?.data?.error?.message,
    e?.response?.data?.message,
    e?.message,
  ].filter(Boolean);
  if (candidates.length > 0) return String(candidates[0]);
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Call LLM completion with key rotation & exponential backoff on 429/403/5xx errors,
 * with automatic fallback for provider-specific tool_choice or invalid API key 400 errors.
 */
export async function callLlmWithRetry(
  modelConfig: ModelConfig,
  params: Omit<ChatCompletionCreateParamsNonStreaming, "model">,
  maxRetriesPerKey = 2
): Promise<ChatCompletion> {
  // No keys at all for a provider that requires one — fail fast with a clear
  // message instead of sending a "dummy" key and getting a confusing 400 back.
  if (modelConfig.apiKeys.length === 0) {
    throw new Error(
      `Model ${modelConfig.spec} skipped — no API key found for provider "${modelConfig.provider}". Check your .env variable name matches exactly (case-sensitive).`
    );
  }

  const keys = modelConfig.apiKeys;
  let lastError: unknown = null;
  let lastDetail = "";

  for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
    const apiKey = keys[keyIdx];

    const client = new OpenAI({
      apiKey,
      baseURL: modelConfig.baseUrl,
    });

    let attempt = 0;
    while (attempt <= maxRetriesPerKey) {
      try {
        return await client.chat.completions.create({
          ...params,
          model: modelConfig.modelName,
        });
      } catch (err: unknown) {
        lastError = err;
        lastDetail = extractErrorDetail(err);
        attempt++;
        const status = (err as { status?: number })?.status;

        // Handle tool_choice="required" not being supported by this provider
        if (status === 400 && /tool_choice|tool/i.test(lastDetail) && params.tool_choice === "required") {
          try {
            return await client.chat.completions.create({
              ...params,
              tool_choice: "auto",
              model: modelConfig.modelName,
            });
          } catch (retryErr) {
            lastError = retryErr;
            lastDetail = extractErrorDetail(retryErr);
          }
        }

        if (status === 400) {
          if (keyIdx < keys.length - 1) break; // try next key
          throw new Error(`Model ${modelConfig.spec} failed (HTTP 400: ${lastDetail})`);
        }

        const isRateLimit = status === 429 || status === 403;
        const isServerError = status !== undefined && status >= 500 && status < 600;

        if (isRateLimit || isServerError) {
          if (keyIdx < keys.length - 1) break;

          if (attempt <= maxRetriesPerKey) {
            const headers = (err as { headers?: Record<string, string> })?.headers;
            const retryAfterHeader = headers?.["retry-after"] || headers?.["x-ratelimit-reset"];
            let delayMs = Math.pow(2, attempt) * 1000;
            if (retryAfterHeader) {
              const parsed = parseInt(retryAfterHeader, 10);
              if (!isNaN(parsed)) {
                delayMs = parsed > 1000 ? parsed - Date.now() : parsed * 1000;
                delayMs = Math.max(1000, Math.min(delayMs, 10000));
              }
            }
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }
        }
        throw new Error(`Model ${modelConfig.spec} failed (${lastDetail})`);
      }
    }
  }

  throw new Error(
    `All API keys failed for model ${modelConfig.spec}. Last error: ${lastDetail || String(lastError)}`
  );
}

export const llm = {
  callLlmWithRetry,
};