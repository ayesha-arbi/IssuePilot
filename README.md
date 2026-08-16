# IssuePilot 🚀

[![npm version](https://img.shields.io/npm/v/issuepilot.svg)](https://www.npmjs.com/package/issuepilot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/ayesha-arbi/IssuePilot/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/ayesha-arbi/IssuePilot/actions)

> An autonomous AI agent CLI that investigates GitHub issues and generates comprehensive "starter briefs" for first-time open-source contributors — identifying likely root causes, relevant files, related past PRs, and difficulty ratings.

---

## 💡 Why IssuePilot?

First-time open-source contributors often get stuck figuring out where to start. **`issuepilot`** is a **true autonomous ReAct agent** (not a hardcoded script). It fetches the issue, formulates search terms, inspects code files, checks past pull requests, evaluates repository guidelines, and dynamically decides when it has enough context to produce an actionable starter brief.

---

## ⚡ Quickstart

No installation required! Run instantly via `npx`:

```bash
npx issuepilot <url> 
```

On first run, `issuepilot` will launch an interactive wizard to prompt for your `GITHUB_TOKEN` and optional LLM keys.

---

## 🛠️ Interactive Setup Wizard

Run the interactive setup wizard at any time:

```bash
npx issuepilot init
```

---

## 🤖 Supported Free-Tier AI Providers & Multi-Key Rotation

`issuepilot` features a resilient multi-provider fallback engine with **multi-key rotation** for high availability:

| Provider | Env Key(s) | Free Tier Highlights |
| :--- | :--- | :--- |
| **Pollinations.ai** | *(None required)* | **Zero key required, works out of the box!** |
| **Groq** | `GROQ_API_KEY` | 30 RPM / 14,400 req/day ultra-fast Llama 3.3 — **recommended free provider** |
| **GitHub Models** | `GITHUB_TOKEN` | Free LLM inference included with your GitHub PAT! |
| **xAI / Grok** | `GROK_API_KEY`, `XAI_API_KEY` | Grok-beta & Grok-2 support |
| **Cerebras** | `CEREBRAS_API_KEY` | 30 RPM ultra-fast inference |
| **OpenRouter** | `OPENROUTER_API_KEY` | Access to all OpenRouter free models (`:free`) |
| **OpenAI / Custom** | `OPENAI_API_KEY`, `LLM_BASE_URL` | OpenAI or local Ollama / vLLM endpoints |

### Multi-Key Rotation
Supply multiple API keys for any provider (comma-separated or indexed) for automatic key rotation on rate limits:
```env
GROQ_API_KEY_1="groq_key1"
GROQ_API_KEY_2="groq_key2"
```

---

## 📖 CLI Usage & Options

```bash
# Basic execution
npx issuepilot <issue-url>

# Output as raw JSON
npx issuepilot <issue-url> --json

# Save brief to a local file
npx issuepilot <issue-url> -o brief.md

# Copy brief directly to system clipboard
npx issuepilot <issue-url> -c

# Specify maximum agent investigation turns
npx issuepilot <issue-url> --max-turns 20

# Specify custom provider/model fallback sequence
npx issuepilot <issue-url> --fallback-models gemini/gemini-2.0-flash,groq/llama-3.3-70b-versatile,pollinations/openai
```

---

## 🏗️ Architecture

```
                       Issue URL
                           │
                           ▼
                 Fetch Issue & Guidelines
                           │
                           ▼
           ┌──────────────────────────────────┐
           │     ReAct AI Agent Loop          │
           │  (Forced Tool Choice Turn 0)     │
           └────────────────│─────────────────┘
                            │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
  search_codebase      read_file       search_history
  (Qualifiers &     (Line Slicing)      (GET /search)
   Path Ranking)           │                 │
         │                 └────────┬────────┘
         └──────────────────────────┤
                                    ▼
                           submit_brief(...)
                                    │
                          Schema Validator
                                    │
                                 Success
                                    ▼
                          Terminal Brief Output
```

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on setting up the local environment and running tests.

```bash
git clone https://github.com/ayesha-arbi/IssuePilot.git
cd IssuePilot
npm install
npm test
```

---

## 📄 License

[MIT](LICENSE) © IssuePilot Team
