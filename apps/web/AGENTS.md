# WEB APP GUIDE

## OVERVIEW
`apps/web` is the Next.js 15 UI and API surface. It owns the app shell, the large client-side council interface, local i18n/visualization helpers, and thin Node route handlers.

## STRUCTURE
```text
apps/web/
|- app/                # Server entrypoints, layout, API routes
|- components/         # Main client UI + shadcn-style primitives
|- lib/                # i18n, visualization, helpers
`- pages/_document.tsx # Legacy bridge only
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Initial data bootstrapping | `app/page.tsx` | Server component loading sessions/settings/catalog |
| Global layout/fonts | `app/layout.tsx` | Korean HTML lang + font wiring |
| Main UI state and polling | `components/council-app.tsx` | Monolithic client component |
| UI copy and locale helpers | `lib/i18n.ts` | `ko`, `en`, `ja` strings |
| Debate visualization shaping | `lib/council-visualization.ts` | Session detail -> progress model |
| Route conventions | `app/api/AGENTS.md` | Read before editing API handlers |

## CONVENTIONS
- `app/page.tsx` is intentionally `dynamic = "force-dynamic"` because live session data and provider catalog are fetched on each load.
- API handlers are thin wrappers; most real logic belongs in shared packages.
- Use `@/*` for app-local imports and `@ship-council/*` for package imports.
- Design tokens live in `app/globals.css` as CSS variables; UI primitives use the same token system.
- `components/council-app.tsx` uses polling for live updates and popup polling for OAuth completion.
- `lib/i18n.ts` is the source of truth for UI copy; keep locale keys aligned across all three languages.

## ANTI-PATTERNS
- Do not move provider/session business logic from packages into the web layer.
- Do not split or rename locale keys in one language only.
- Do not assume the main UI is server-driven; most interaction state lives in the client component.
- Do not add a second styling system alongside the existing Tailwind + CSS-variable setup.

## NOTES
- `pages/_document.tsx` exists as a minimal compatibility shim, not as the primary routing model.
- `components/ui/` follows familiar shadcn-style patterns; read the component file directly instead of expecting extra local docs.
