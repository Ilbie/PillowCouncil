# PACKAGES GUIDE

## OVERVIEW
`packages/` holds the reusable domain modules that the web app composes: persistence, providers, orchestration, personas, and export formatting.

## STRUCTURE
```text
packages/
|- shared/          # SQLite, repository, Zod types
|- providers/       # OpenCode auth/catalog/runtime
|- orchestration/   # Debate engine + run pipeline
|- agents/          # Panel presets and prompts
`- exports/         # Markdown/JSON formatting
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add/change persistence | `shared/AGENTS.md` | Most non-obvious package rules live there |
| Change provider connection logic | `providers/AGENTS.md` | Catalog, auth, and runtime are separate concerns |
| Change debate sequencing | `orchestration/AGENTS.md` | `run-session.ts` is the main hotspot |
| Change agent presets/prompts | `agents/AGENTS.md` | Semantic edits matter more than type complexity |
| Change export output | `exports/src/formatters.ts` | Small pure module; read file directly |

## CONVENTIONS
- Public package surfaces are small barrel exports from `src/index.ts`.
- Cross-package imports should stay on public `@ship-council/*` entry points unless a file already uses package-internal paths.
- `packages/shared` owns canonical domain types consumed elsewhere.
- `packages/providers` owns all OpenCode-facing behavior; other packages should consume its exported APIs, not reimplement provider logic.

## ANTI-PATTERNS
- Do not add another source of truth for session/run/message types outside `packages/shared`.
- Do not move OpenCode auth or runtime logic into `apps/web` route handlers.
- Do not create child docs for tiny packages unless the domain is genuinely opaque; `packages/exports` stays file-driven on purpose.

## CHILD DOCS
- `packages/shared/AGENTS.md`
- `packages/providers/AGENTS.md`
- `packages/orchestration/AGENTS.md`
- `packages/agents/AGENTS.md`
