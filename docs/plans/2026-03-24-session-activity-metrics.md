# Session Activity Metrics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a new session activity metrics panel that shows MCP calls, skill usage, web searches, token input/output, and total work time on the session dashboard.

**Architecture:** Extend the provider/runtime pipeline so each OpenCode generation can report activity counters alongside token usage, persist those counters on `session_runs`, expose a typed `activityMetrics` shape on `SessionDetailResponse`, and render the metrics in the right-hand decision sidebar using existing dashboard styles. Keep aggregation in shared/package layers, not the web layer.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, SQLite/Drizzle, Vitest, OpenCode SDK runtime bridge.

---

### Task 1: Define the failing UI expectation

**Files:**
- Modify: `tests/unit/apps/web/components/council-sections.test.ts`

**Step 1: Write the failing test**

Add a `DecisionSidebar` assertion that expects the new activity metrics panel to render labels and values for MCP calls, skill usage, web searches, token input, token output, and total duration.

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/apps/web/components/council-sections.test.ts`

Expected: FAIL because the metrics panel does not exist yet.

### Task 2: Persist activity counters in the data model

**Files:**
- Modify: `packages/shared/src/schema.ts`
- Modify: `packages/shared/src/db.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/repository.ts`

**Step 1: Add run-level columns and public types**

Add integer counters for MCP calls, skill invocations, and web searches to `session_runs`, plus a typed `SessionActivityMetrics` object on the shared API response.

**Step 2: Expose the metrics from session detail queries**

Map the persisted counters and duration fields into `getSessionDetail()` so the web app receives all required metrics in one payload.

### Task 3: Capture activity usage from the OpenCode runtime

**Files:**
- Modify: `packages/providers/src/runtime.ts`
- Modify: `packages/orchestration/src/process-session-run.ts`
- Modify: `packages/orchestration/src/run-session.ts` (only if callback typing requires it)

**Step 1: Extend runtime result typing**

Augment provider results so each generation can return activity counters in addition to token usage.

**Step 2: Derive counters from OpenCode response parts/events**

Inspect prompt results and count tool invocations by type, classifying MCP, skill, and web search usage into stable counters.

**Step 3: Persist counters through orchestration callbacks**

Accumulate the new counters at run time in the same way token usage is accumulated today.

### Task 4: Render the dashboard panel

**Files:**
- Modify: `apps/web/components/council/DecisionSidebar.tsx`
- Modify: `apps/web/lib/council-app-labels.ts`

**Step 1: Add locale-safe labels/helpers**

Create the panel title, metric labels, and formatting helpers for Korean, English, and Japanese.

**Step 2: Add the activity metrics card**

Render a compact dashboard card in the right sidebar that matches the current dark visual system and shows the requested values.

### Task 5: Verify end-to-end behavior

**Files:**
- Verify: modified source files above

**Step 1: Run unit tests**

Run: `npm test -- --run tests/unit/apps/web/components/council-sections.test.ts`

Expected: PASS

**Step 2: Run typecheck and build**

Run: `npm run typecheck`

Expected: PASS

Run: `npm run build`

Expected: PASS
