import readline from "readline";
import fs from "fs";
import path from "path";

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function runInitWizard(): Promise<void> {
  console.log("\n🚀 Welcome to issuepilot Setup Wizard!\n");
  console.log("This wizard will help you configure your API keys for repository analysis.\n");

  let githubToken = process.env.GITHUB_TOKEN || "";
  if (!githubToken) {
    githubToken = await askQuestion("🔑 Enter your GitHub Personal Access Token (GITHUB_TOKEN) [required]: ");
    while (!githubToken) {
      console.log("❌ GITHUB_TOKEN is required to search repositories.");
      githubToken = await askQuestion("🔑 Enter your GitHub Personal Access Token (GITHUB_TOKEN): ");
    }
  } else {
    console.log(`✔ Found existing GITHUB_TOKEN in environment.`);
  }

  console.log("\n--- Optional AI Model Provider Keys (Press Enter to skip) ---\n");
  console.log("⚠️  NOTE: As of mid-2026, Google deprecated unrestricted Gemini API keys.");
  console.log("   Standard keys (AIzaSy...) no longer work. New service-account-bound");
  console.log("   credentials are rolling out through Sept 2026. If Gemini fails with");
  console.log("   HTTP 400, use Groq or OpenRouter instead — both are free and reliable.\n");

  const geminiKey = await askQuestion("🤖 Google Gemini API Key (GEMINI_API_KEY) [optional, may not work — see above]: ");
  const groqKey = await askQuestion("⚡ Groq API Key (GROQ_API_KEY) [optional, recommended — free at console.groq.com]: ");
  const openrouterKey = await askQuestion("🌐 OpenRouter API Key (OPENROUTER_API_KEY) [optional — free tier at openrouter.ai]: ");

  const envLines: string[] = [
    `# GitHub Personal Access Token (required for repo analysis & free GitHub Models inference)`,
    `GITHUB_TOKEN=${githubToken}`,
    "",
  ];

  if (geminiKey) {
    envLines.push(`# Google Gemini API Key`, `GEMINI_API_KEY=${geminiKey}`, "");
  } else if (process.env.GEMINI_API_KEY) {
    envLines.push(`GEMINI_API_KEY=${process.env.GEMINI_API_KEY}`, "");
  }

  if (groqKey) {
    envLines.push(`# Groq API Key`, `GROQ_API_KEY=${groqKey}`, "");
  } else if (process.env.GROQ_API_KEY) {
    envLines.push(`GROQ_API_KEY=${process.env.GROQ_API_KEY}`, "");
  }

  if (openrouterKey) {
    envLines.push(`# OpenRouter API Key`, `OPENROUTER_API_KEY=${openrouterKey}`, "");
  } else if (process.env.OPENROUTER_API_KEY) {
    envLines.push(`OPENROUTER_API_KEY=${process.env.OPENROUTER_API_KEY}`, "");
  }

  envLines.push(`# Note: Pollinations.ai (zero-key fallback) is always enabled. Groq is the most reliable free provider.`);
  envLines.push(`# Gemini keys may fail with HTTP 400 (Google deprecated unrestricted keys mid-2026). Use Groq/OpenRouter instead.`);

  const envPath = path.resolve(process.cwd(), ".env");
  fs.writeFileSync(envPath, envLines.join("\n"), "utf-8");

  // Load into process.env immediately
  process.env.GITHUB_TOKEN = githubToken;
  if (geminiKey) process.env.GEMINI_API_KEY = geminiKey;
  if (groqKey) process.env.GROQ_API_KEY = groqKey;
  if (openrouterKey) process.env.OPENROUTER_API_KEY = openrouterKey;

  console.log(`\n✅ Configuration saved to ${envPath}!`);
  console.log("You're all set to run: npx issuepilot <github-issue-url>\n");
}
