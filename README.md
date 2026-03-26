# PillowCouncil

<p align="center">
  <img src="./asset/logo.svg" alt="PillowCouncil logo" width="180" />
</p>

<p align="center"><strong>Your personal board of AI directors.</strong></p>

<p align="center">
  PillowCouncil is a local, self-hosted multi-agent debate workspace for pressure-testing ideas,
  reviewing product and engineering decisions, and turning messy discussions into a concrete final recommendation.
</p>

> [!WARNING]
> This repository is in active development and is published for npm usage.
> It may contain bugs and potential security vulnerabilities.
> Use in production with caution.

<p align="center">
  <a href="./docs/ko/README.md">한국어</a>
  ·
  <a href="./README.md">English</a>
  ·
  <a href="./docs/ja/README.md">日本語</a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a>
  ·
  <a href="./docs/README.md">Docs</a>
  ·
  <a href="#monorepo-layout">Architecture</a>
</p>

## Why teams reach for PillowCouncil

| What you get | Why it matters |
| --- | --- |
| Local, self-hosted workflow | Keep decision history, presets, and app data on your machine. |
| Structured debate stages | Move from opening opinions to rebuttals, a moderator summary, and a final recommendation. |
| OpenCode-managed credentials | Reuse provider auth without building a custom secret storage layer in the app. |
| Action-oriented outputs | Finish with explicit risks, alternatives, and next actions instead of vague AI summaries. |

## Why PillowCouncil?

Most AI chats end with a decent answer but weak decision pressure. PillowCouncil creates a structured panel instead:

- multiple agents argue from different perspectives
- rebuttals force weak claims to surface early
- the moderator distills trade-offs into a final recommendation
- every run ends with risks, alternatives, and next actions you can actually execute

## What it does

- **Structured multi-agent debates** with opinion, rebuttal, moderator summary, and final recommendation stages
- **Reusable OpenCode-powered connections** for provider, login method, and model selection
- **Local-first persistence** backed by SQLite for sessions, presets, and settings
- **Korean, English, and Japanese support** for both UI and generated debate output
- **Preset-based and AI-generated panels** so you can start from built-in councils like SaaS Founder, Product Scope, and Architecture Review or generate a custom one
- **Markdown and JSON exports** for sharing outcomes outside the app
- **Live session workflow** that updates the debate timeline as runs progress
- **Optional CLI packaging path** via the `pillow-council` binary in this repository

## How it works

PillowCouncil separates connection setup from session execution:

1. Choose a provider, login method, and model through the web UI.
2. Save the connection through OpenCode's credential flow.
3. Create a new session with a topic, panel preset, language, and debate intensity.
4. Run the council and follow the timeline as messages and rounds are stored.
5. Review the final recommendation, risks, alternatives, and TODO list.
6. Export the result as Markdown or JSON when needed.

## Quick start

### Install from npm (global)

PillowCouncil is published on npm.

```bash
npm i -g pillow-council
```

Then run the CLI:

```bash
pillow-council
```

### Run from source

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000` and configure your provider connection in the UI.

### Native SQLite note for Windows + WSL

`better-sqlite3` is a native module, so one `node_modules` folder cannot safely serve both Windows Node.js and WSL/Linux Node.js at the same time.

- If you run PillowCouncil from **PowerShell / Command Prompt**, rebuild native modules there.
- If you run PillowCouncil from **WSL Ubuntu**, rebuild native modules inside WSL.

When you switch runtimes, run:

```bash
npm run native:rebuild
```

If you see errors like `not a valid Win32 application` or `invalid ELF header`, the current shell is loading a binary built for the other runtime.

### Run through the packaged CLI

This repository already exposes a `pillow-council` CLI entrypoint for standalone builds.

```bash
npm install
npm run build
npx pillow-council
```

If you published the package, you can also run it with `npm i -g pillow-council` and then `pillow-council`.

## Connection model

- No local project `.env` file is required for provider credentials.
- API keys are stored in the OpenCode credential store, not in PillowCouncil's SQLite tables.
- Browser-based login flows are started by OpenCode and reused by PillowCouncil.
- PillowCouncil stores the selected provider, login method, and model as reusable app settings.
- App data is stored locally under `~/.pillow-council/`, including the default SQLite database at `~/.pillow-council/data/pillow-council.db`.

## Monorepo layout

```text
apps/web                 Next.js 15 App Router UI and API surface
packages/shared          SQLite access, schema, repository, shared types
packages/agents          Built-in presets and custom preset generation
packages/providers       OpenCode catalog, auth, and runtime bridge
packages/orchestration   Debate engine and session execution pipeline
packages/exports         Markdown and JSON export helpers
scripts/                 Database reset, inspection, and standalone prep
tests/                   Vitest and Playwright coverage
```

## Developer commands

```bash
# Start the web app
npm run dev

# Run the standalone-ready production build
npm run build

# Type-check all workspaces
npm run typecheck

# Run unit and integration tests
npm test

# Run Playwright end-to-end tests
npm run test:e2e

# Inspect the local SQLite database
npm run db:inspect

# Rebuild native sqlite bindings for the current shell/runtime
npm run native:rebuild
```

## Documentation

- [Documentation hub](./docs/README.md)
- [English overview](./docs/en/README.md)
- [한국어 문서](./docs/ko/README.md)
- [日本語ドキュメント](./docs/ja/README.md)

## Tech stack

- Next.js 15 + React 19
- TypeScript monorepo
- SQLite with shared repository/schema package
- OpenCode SDK and runtime integration
- Vitest + Playwright for verification

## License

Released under the [License](./LICENSE).
