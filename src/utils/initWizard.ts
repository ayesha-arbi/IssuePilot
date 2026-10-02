import readline from "readline";
import fs from "fs";
import path from "path";
import { Readable } from "node:stream";

import { PROVIDERS } from "../utils/llm.js";

function askQuestion(
  query: string,
  input: Readable = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<string | null> {
  if (input.readableEnded) return Promise.resolve(null);

  const rl = readline.createInterface({ input, output });
  return new Promise((resolve) => {
    let answered = false;
    rl.question(query, (answer) => {
      answered = true;
      rl.close();
      resolve(answer.trim());
    });
    rl.on("close", () => {
      if (!answered) resolve(null);
    });
  });
}

const NON_INTERACTIVE_HELP = [
  "❌ GITHUB_TOKEN is not set, and there is no input available to ask for one.",
  "",
  "Set it before running non-interactively:",
  "  export GITHUB_TOKEN=ghp_xxx        # bash / zsh",
  '  $env:GITHUB_TOKEN="ghp_xxx"        # PowerShell',
  "  echo GITHUB_TOKEN=ghp_xxx > .env   # or use a .env file",
  "",
  "In GitHub Actions:  env:  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}",
  "",
  "Or run 'npx issuepilot init' in a normal terminal to set it up.",
].join("\n");

/** Asks until a non-empty answer is given; fails clearly if no input is available. */
async function requireAnswer(query: string, emptyMsg: string): Promise<string> {
  for (;;) {
    const answer = await askQuestion(query);
    if (answer === null) throw new Error(NON_INTERACTIVE_HELP);
    if (answer) return answer;
    console.log(emptyMsg);
  }
}

export async function runInitWizard(): Promise<void> {
  console.log("\n🚀 Welcome to issuepilot Setup Wizard!\n");
  console.log("This wizard will help you configure your API keys for repository analysis.\n");

  let githubToken = process.env.GITHUB_TOKEN || "";
  if (!githubToken) {
    githubToken = await requireAnswer(
      "🔑 Enter your GitHub Personal Access Token (GITHUB_TOKEN) [required]: ",
      "❌ GITHUB_TOKEN is required to search repositories.",
    );
  } else {
    console.log(`✔ Found existing GITHUB_TOKEN in environment.`);
  }

  console.log("\n--- Optional AI Model Provider Keys (Press Enter to skip) ---\n");
  console.log("⚠️  NOTE: As of mid-2026, Google deprecated unrestricted Gemini API keys.");
  console.log("   Standard keys (AIzaSy...) no longer work. New service-account-bound");
  console.log("   credentials are rolling out through Sept 2026. If Gemini fails with");
  console.log("   HTTP 400, use Groq or OpenRouter instead — both are free and reliable.");
  console.log("   ⚠️  Terminal keystrokes may be visible — consider pasting from a");
  console.log("      password manager or editor.\n");

  const geminiKey = await askQuestion("🤖 Google Gemini API Key (GEMINI_API_KEY) [optional, may not work — see above]: ");
  const groqKey = await askQuestion("⚡ Groq API Key (GROQ_API_KEY) [optional, recommended — free at console.groq.com]: ");
  const openrouterKey = await askQuestion("🌐 OpenRouter API Key (OPENROUTER_API_KEY) [optional — free tier at openrouter.ai]: ");

  const envLines: string[] = [
    `# GitHub Personal Access Token (required for repo analysis & free GitHub Models inference)`,
    `GITHUB_TOKEN=${githubToken}`,
    "",
  ];

  // Preserve all known provider API keys from environment generically.
  // Instead of hardcoding only GEMINI/GROQ/OPENROUTER, iterate over all providers
  // defined in llm.ts so that CEREBRAS, TOGETHER, DEEPSEEK, MISTRAL, OPENAI, etc.
  // are also preserved on rerun of the init wizard.
  for (const [providerKey, provider] of Object.entries(PROVIDERS) as [string, { envVars: string[] }][]) {
    for (const envVar of provider.envVars) {
      // GITHUB_TOKEN is already written above; skip to avoid duplication
      if (envVar === "GITHUB_TOKEN") continue;
      if (process.env[envVar]) {
        envLines.push(`${envVar}=${process.env[envVar]}`);
      }
    }
  }

  // Note: Gemini keys (GEMINI_API_KEY) are covered above via the "google"
  // prefix in PROVIDERS.envVars, so no separate block is needed.

  envLines.push(`# Note: Pollinations.ai (zero-key fallback) is always enabled. Groq is the most reliable free provider.`);
  envLines.push(`# Gemini keys may fail with HTTP 400 (Google deprecated unrestricted keys mid-2026). Use Groq/OpenRouter instead.`);

  const envPath = path.resolve(process.cwd(), ".env");
  fs.writeFileSync(envPath, envLines.join("\n"), "utf-8");

  // Restrict .env file permissions to owner-only (0o600) to prevent
  // other users/processes on the same machine from reading secrets.
  fs.chmodSync(envPath, 0o600);

  // Load into process.env immediately
  process.env.GITHUB_TOKEN = githubToken;
  if (geminiKey) process.env.GEMINI_API_KEY = geminiKey;
  if (groqKey) process.env.GROQ_API_KEY = groqKey;
  if (openrouterKey) process.env.OPENROUTER_API_KEY = openrouterKey;

  console.log(`\n✅ Configuration saved to ${envPath}!`);
  console.log("You're all set to run: npx issuepilot <github-issue-url>\n");
}
