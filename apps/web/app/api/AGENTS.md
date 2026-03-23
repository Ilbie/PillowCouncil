# API ROUTES GUIDE

## OVERVIEW
`apps/web/app/api` contains thin Next.js route handlers for sessions, settings, provider catalog, auth connections, and export endpoints.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Session CRUD | `sessions/route.ts`, `sessions/[id]/route.ts` | Backed by `@ship-council/shared` |
| Run control | `sessions/[id]/run/route.ts` | Starts/stops orchestration |
| Export endpoints | `sessions/[id]/export/route.ts` | Uses `@ship-council/exports` |
| App settings | `settings/route.ts` | Validates provider/model/auth selections |
| Provider catalog | `providers/models/route.ts` | Reads `@ship-council/providers` catalog |
| OAuth/account flow | `auth/accounts/**` | Start, callback, list, disconnect |

## CONVENTIONS
- Route files declare `export const runtime = "nodejs"`.
- Keep handlers thin: parse request, call package API, return JSON/Response.
- Validate incoming settings against shared/provider schemas before persisting.
- Error responses use small JSON payloads with an `error` string.
- Auth/account routes should delegate to `@ship-council/providers`; do not inline OAuth mechanics here.

## ANTI-PATTERNS
- Do not move repository or provider lifecycle logic into route files.
- Do not return inconsistent error shapes unless the endpoint already has a special response contract.
- Do not bypass provider/model/auth validation when saving settings.
- Do not forget export-format branching in export routes; markdown and JSON are both supported.

## NOTES
- Run routes are the web entrypoint into orchestration, so changes here can affect cancellation and session status semantics.
- OAuth routes participate in the popup-based login flow used by the client app; preserve that contract when editing callbacks.
