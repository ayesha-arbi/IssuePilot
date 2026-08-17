# IssuePilot 🚀

[![npm version](https://img.shields.io/npm/v/issuepilot1.svg)](https://www.npmjs.com/package/issuepilot1)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/ayesha-arbi/IssuePilot/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/ayesha-arbi/IssuePilot/actions)

> An AI agent that turns GitHub issues into practical starter briefs for first time open source contributors.

## Why IssuePilot?

Starting an open source issue can be confusing, especially when you do not know the codebase.

IssuePilot investigates the issue, searches the relevant code, checks past pull requests and repository guidelines, then gives you a clear starting point.

It uses a ReAct style agent that decides what to investigate instead of following a fixed script.

## Quickstart

Run IssuePilot directly with npx:

```bash
npx issuepilot1 <issue-url>
```

On the first run, IssuePilot will guide you through setup and ask for your GitHub token and optional LLM API keys.

## Setup

You can run the setup wizard anytime:

```bash
npx issuepilot1 init
```

## What you get

A starter brief containing:

• What the issue is about
• Likely cause
• Relevant files to inspect
• Related past pull requests
• Difficulty estimate
• Suggested first step

## Options

```bash
npx issuepilot1 <issue-url> --json
npx issuepilot1 <issue-url> -o brief.md
npx issuepilot1 <issue-url> -c
npx issuepilot1 <issue-url> --max-turns 20
```

## Architecture

```text
GitHub Issue
     ↓
Issue & Guidelines
     ↓
ReAct Agent
     ↓
Code Search + File Reading + PR History
     ↓
Starter Brief
```

## Contributing

Contributions are welcome.

```bash
git clone https://github.com/ayesha-arbi/IssuePilot.git
cd IssuePilot
npm install
npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## License

MIT © IssuePilot Team
