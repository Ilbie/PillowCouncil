# PROVIDERS GUIDE

## OVERVIEW
`packages/providers` is the only OpenCode bridge. It owns server lifecycle, provider catalog shaping, auth flows, and model execution.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| OpenCode process/client lifecycle | `src/opencode.ts` | Spawns isolated server, manages singleton handle |
| Provider/model catalog shaping | `src/catalog.ts` | Filters, scores, caches models |
| API key + OAuth flows | `src/account-auth.ts` | All auth mutations live here |
| Text/JSON generation | `src/runtime.ts` | Real provider + mock provider |

## CONVENTIONS
- Keep the three boundaries separate: `opencode.ts` boots the SDK, `catalog.ts` reads metadata, `account-auth.ts` mutates auth state, `runtime.ts` executes prompts.
- OpenCode uses the standard credential-store root (`XDG_DATA_HOME` when provided, otherwise the platform default) so Council sees the same saved auth state as OpenCode.
- Auth mode IDs are opaque `api:N` / `oauth:N` strings. Preserve that encoding unless the whole app migrates.
- `loadProviderCatalog()` filters deprecated and non-conversation models before the UI sees them.
- Tests should mock provider/runtime behavior explicitly instead of relying on env toggles.

## ANTI-PATTERNS
- Do not add provider-specific logic in route handlers or orchestration; extend this package instead.
- Do not persist raw API keys into SQLite.
- Do not assume `temperature` is honored; runtime currently ignores it.
- Do not forget to invalidate the catalog cache after auth mutations.
- Do not fork credential persistence outside the standard OpenCode data-home flow unless the whole app is intentionally redesigned around isolated auth storage.

## GOTCHAS
- The OpenCode server handle is module-global; be careful with long-lived dev processes and tests.
- Session cleanup in runtime is best-effort; if you change lifecycle handling, keep orphaned-session risk in mind.
- `getDefaultModelId()` can fall back to the first available provider/model when a saved provider disappears.
