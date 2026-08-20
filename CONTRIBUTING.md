# Contributing to IssuePilot

Thank you for your interest in contributing to `issuepilot`!

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ayesha-arbi/IssuePilot.git
   cd IssuePilot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
    ```bash
    cp .env.example .env
    ```
    Edit `.env` and add your `GITHUB_TOKEN` (required) and any optional LLM keys:
    - `GEMINI_API_KEY` — Google Gemini (may fail with HTTP 400, use Groq/OpenRouter instead)
    - `GROQ_API_KEY` — Groq (free and recommended)
    - `OPENROUTER_API_KEY` — OpenRouter (free tier)
    - `CEREBRAS_API_KEY`, `TOGETHER_API_KEY`, `DEEPSEEK_API_KEY`, `MISTRAL_API_KEY` — optional providers
    - `LLM_API_KEY` / `LLM_BASE_URL` / `MODEL_FALLBACKS` — custom provider configuration

4. **Build and test:**
   ```bash
   npm run build
   npm test
   ```

## Running locally

```bash
# Run CLI via tsx
npm run brief -- https://github.com/owner/repo/issues/123

# Watch mode
npm run dev -- https://github.com/owner/repo/issues/123
```

## Pull Request Guidelines

- Ensure all unit and integration tests pass (`npm test`).
- Ensure TypeScript compiles without errors (`npx tsc --noEmit`).
- Keep code clean, modular, and well-typed.
