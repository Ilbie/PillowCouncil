# PillowCouncil Documentation

> English reference overview for GitHub readers and contributors.

> [!WARNING]
> This repository is in active development and is published for npm usage.
> It may contain bugs and potential security vulnerabilities.
> Use with caution in production.

## Summary

PillowCouncil is a local, self-hosted multi-agent decision workspace. It helps you run structured debates between AI personas, surface disagreement early, and finish with a final recommendation, explicit risks, alternatives, and next actions.

## Why it is useful

- turn one-off AI chats into a reusable decision process
- compare conflicting viewpoints instead of accepting the first answer
- keep sessions, presets, and settings local with SQLite-backed persistence
- reuse OpenCode provider connections without building custom auth storage

## What you get

- structured debates across opening, rebuttal, summary, and final recommendation stages
- reusable provider, login, and model configuration through OpenCode
- built-in councils such as **SaaS Founder**, **Product Scope**, and **Architecture Review**
- AI-generated custom presets when the default panels are not enough
- Korean, English, and Japanese output options
- Markdown and JSON export support

## Product flow

1. Configure provider, login method, and model.
2. Save the connection through OpenCode.
3. Create a session with topic, preset, language, and debate intensity.
4. Run the debate and follow progress in the timeline.
5. Review the final recommendation and export it if needed.

## Local runtime model

- credentials are handled by OpenCode
- app settings and session history are handled by PillowCouncil
- app data lives under `~/.pillow-council/`
- the default SQLite database path is `~/.pillow-council/data/pillow-council.db`

## Repository structure

```text
apps/web                 Next.js UI and API routes
packages/shared          database, schema, repository, and shared types
packages/agents          built-in personas and preset generation
packages/providers       OpenCode integration layer
packages/orchestration   debate execution engine
packages/exports         export formatting helpers
```

## Commands

```bash
npm run dev
npm run build
npm run typecheck
npm test
npm run test:e2e
npm run db:inspect
```

## Related docs

- [GitHub README](../../README.md)
- [Docs hub](../README.md)
- [한국어](../ko/README.md)
- [日本語](../ja/README.md)
