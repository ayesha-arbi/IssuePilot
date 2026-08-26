import { PROVIDERS } from "../src/utils/llm.js";

const CHECKABLE: Record<string, { url: string; envVar?: string }> = {
  groq: { url: "https://api.groq.com/openai/v1/models", envVar: "GROQ_API_KEY" },
  openrouter: { url: "https://openrouter.ai/api/v1/models" },
};

let drift = false;

for (const [name, cfg] of Object.entries(CHECKABLE)) {
  const token = cfg.envVar ? process.env[cfg.envVar] : undefined;
  if (cfg.envVar && !token) {
    console.log(`- ${name}: skipped (no ${cfg.envVar})`);
    continue;
  }

  const res = await fetch(cfg.url, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
  if (!res.ok) {
    console.log(`- ${name}: skipped (HTTP ${res.status})`);
    continue;
  }

  const live = new Set((await res.json()).data.map((m: { id: string }) => m.id));
  for (const model of PROVIDERS[name].defaultModels) {
    if (live.has(model)) {
      console.log(`✔ ${name}/${model}`);
    } else {
      console.error(`✖ ${name}/${model} is no longer offered by ${name}`);
      drift = true;
    }
  }
}

process.exit(drift ? 1 : 0);