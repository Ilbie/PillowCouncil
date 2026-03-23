# ORCHESTRATION GUIDE

## OVERVIEW
`packages/orchestration` runs the debate engine. It turns a saved session into opening rounds, rebuttals, moderator summary, and final recommendation.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Main round engine | `src/run-session.ts` | Large async flow with mutable context state |
| Repository-wired runner | `src/process-session-run.ts` | Connects orchestration callbacks to persistence |
| Public exports | `src/index.ts` | Small barrel only |

## FLOW
- Opinion round(s) -> rebuttal round(s) -> moderator summary -> final decision.
- `roundNumber` is global across the whole run, not reset per stage.
- Moderator/final phases require structured JSON output and schema parsing.

## CONVENTIONS
- `ContextState` carries `compressedSummary` plus the rolling recent-message window.
- Compression is not optional bookkeeping; it is part of the run algorithm once context grows beyond limits.
- `assertActive` callbacks are the cancellation guardrails. Keep checks around long-running boundaries.
- Usage accounting happens across multiple paths; preserve token accumulation when refactoring.
- Downstream packages provide the dependencies: presets from `@ship-council/agents`, providers from `@ship-council/providers`, persistence types/callbacks from `@ship-council/shared`.

## ANTI-PATTERNS
- Do not bypass structured output for moderator or final decision phases.
- Do not remove compression triggers without replacing the context-budget strategy.
- Do not mutate run lifecycle in `process-session-run.ts` without checking repository cancellation semantics.
- Do not assume panel presets are arbitrary strings; `panelId` must resolve through `getPanelPreset()`.

## HOTSPOTS
- `src/run-session.ts` mixes prompt formatting, control flow, persistence callbacks, and usage tracking; make small, verified edits.
- Changes to message creation can affect visualization, persistence ordering, and export output at once.
