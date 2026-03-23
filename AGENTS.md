# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-22
**Commit:** n/a (workspace copy, no git metadata)
**Branch:** n/a

## OVERVIEW
Ship Council is a pnpm TypeScript monorepo for running multi-agent panel debates. The Next.js web app delegates persistence to `@ship-council/shared`, model/auth integration to `@ship-council/providers`, and debate execution to `@ship-council/orchestration`.

## READ ORDER
1. Read this file first.
2. Read the nearest `AGENTS.md` in the path you edit.
3. More specific docs override parent guidance.

## STRUCTURE
```text
Council/
|- apps/web/                 # Next.js UI + API routes
|  `- app/api/               # Thin Node route handlers
|- packages/                 # Shared domain packages
|  |- shared/                # SQLite, repository, types, schemas
|  |- providers/             # OpenCode auth/catalog/runtime bridge
|  |- orchestration/         # Round engine + run pipeline
|  `- agents/                # Panel presets and personas
|- scripts/                  # DB reset/inspect utilities
|- tests/                    # Root-level Vitest + Playwright suites
`- data/                     # SQLite files; not source
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| UI behavior, page layout, polling | `apps/web/components/council-app.tsx` | Large client component; most UI state lives here |
| App bootstrap, initial data load | `apps/web/app/page.tsx` | Server component loading sessions, settings, provider catalog |
| API route behavior | `apps/web/app/api/AGENTS.md` | Follow route-local guidance before editing handlers |
| DB schema or repository changes | `packages/shared/AGENTS.md` | Update `schema.ts` and inline DDL together |
| Provider auth/catalog/runtime | `packages/providers/AGENTS.md` | OpenCode integration has isolated credential storage |
| Debate round flow | `packages/orchestration/AGENTS.md` | Context compression and cancellation are central |
| Panel/persona edits | `packages/agents/AGENTS.md` | Semantic changes can silently change output quality |
| Export formatting | `packages/exports/src/formatters.ts` | Small pure formatter module; no local doc |
| Dev DB utilities | `scripts/reset-db.ts`, `scripts/inspect-db.ts` | Both can affect local SQLite files |

## SCOPED GUIDANCE INDEX
- `apps/web/AGENTS.md`
- `apps/web/app/api/AGENTS.md`
- `packages/AGENTS.md`
- `packages/shared/AGENTS.md`
- `packages/providers/AGENTS.md`
- `packages/orchestration/AGENTS.md`
- `packages/agents/AGENTS.md`

## SOURCES OF TRUTH
- Workspace commands: `package.json`
- Workspace layout: `pnpm-workspace.yaml`
- Shared TS aliases: `tsconfig.base.json`
- DB schema + inline migrations: `packages/shared/src/schema.ts`, `packages/shared/src/db.ts`
- Test config: `vitest.config.ts`, `playwright.config.ts`
- Web app package wiring: `apps/web/package.json`, `apps/web/next.config.ts`

## CONVENTIONS
- Use pnpm workspace conventions even though scripts are invoked as `npm run ...`; root scripts already route to workspaces.
- Import internal packages through `@ship-council/*` aliases. In `apps/web`, use `@/*` for app-local imports.
- Keep tests at repo root: Vitest reads `tests/unit/**/*.test.ts` and `tests/integration/**/*.test.ts`; Playwright reads `tests/e2e`.
- `apps/web/app/page.tsx` is intentionally `dynamic = "force-dynamic"`; do not convert it to static assumptions without revisiting live session data flow.
- `data/` is runtime output, not documentation or source.

## ANTI-PATTERNS (THIS PROJECT)
- Do not store provider API keys in Council's SQLite tables; credentials belong in OpenCode's credential store.
- Do not bypass saved provider/auth/model settings when creating sessions; the app intentionally decouples connection setup from session creation.
- Do not introduce custom provider adapters outside `packages/providers`; that package is the single OpenCode bridge.
- Do not treat `scripts/reset-db.ts` or `scripts/inspect-db.ts` as harmless; both can wipe local DB state depending on env.
- Do not assume tests live beside packages; root `tests/` is the canonical test tree here.

## UNIQUE STYLES
- The app is Korean-first in metadata and fonts (`Space Grotesk` + `Noto Sans KR`) but supports `ko`, `en`, and `ja` UI copy.
- Real-time UX is polling-based rather than websocket-based.
- Provider/model lists are filtered and normalized from OpenCode rather than hand-maintained configs.

## COMMANDS
```bash
npm run dev
npm run dev:e2e
npm run build
npm run typecheck
npm test
npm run test:e2e
npm run db:inspect
```

## NOTES
- This workspace copy is not a git repo, so do not rely on branch/commit metadata inside generated docs.
- `dev:e2e` resets `./data/test-e2e.db` before starting the app on port 3100.
- `tests/e2e/` is configured but currently sparse; root docs should mention the harness without overstating coverage.
