# SHARED GUIDE

## OVERVIEW
`packages/shared` is the data backbone: SQLite lifecycle, inline DDL, repository functions, domain types, and Zod schemas.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Table definitions | `src/schema.ts` | Drizzle types only |
| Actual schema creation/migration | `src/db.ts` | Canonical DDL lives here |
| CRUD and run lifecycle | `src/repository.ts` | Large file; all DB writes funnel through it |
| Validation and domain types | `src/types.ts` | Zod + exported types |
| IDs, timestamps, list serialization | `src/utils.ts` | Reuse helpers instead of ad hoc logic |

## CONVENTIONS
- Update `src/schema.ts` and `src/db.ts` together when adding columns or tables. This repo uses inline migration checks, not a separate migration workflow.
- Use `getDb()` for straightforward Drizzle queries; use `getSQLite()` for raw SQL, transactions, and inline migration work.
- Map DB rows through repository mappers before exposing domain objects. Do not leak raw `$inferSelect` shapes into callers.
- Use `createId(prefix)` for new IDs.
- Use `serializeList()` and `parseList()` for array-like TEXT fields.
- Treat `app_settings` as a singleton row keyed by `default`.

## ANTI-PATTERNS
- Do not add a field to `schema.ts` without adding matching DDL and ALTER logic in `src/db.ts`.
- Do not write raw arrays into SQLite TEXT columns.
- Do not bypass `normalizeDebateIntensity()` or related type parsers when handling legacy values.
- Do not store provider secrets here; only provider selection and auth/session bookkeeping belong in this package.
- Do not forget the coupling between `sessions.currentRunId` and `session_runs`; run-state updates must keep them aligned.

## TESTING NOTES
- `resetDatabaseForTests()` closes the singleton connection and removes DB sidecars; use it for clean test setups.
- `scripts/inspect-db.ts` will wipe the DB when `NODE_ENV=test`; avoid accidental test-mode inspection.
