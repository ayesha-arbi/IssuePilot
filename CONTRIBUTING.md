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
   Add your `GITHUB_TOKEN` and any optional LLM keys (Gemini, Groq, OpenRouter).

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
