import { describe, expect, it } from "vitest";

import { calculateSessionActivityMetrics, type SessionRunRecord, type UsageSummary } from "@ship-council/shared";

describe("session activity metrics", () => {
  it("derives counts, token usage, and work duration from run detail data", () => {
    const run: SessionRunRecord = {
      id: "run-1",
      sessionId: "session-1",
      status: "completed",
      workerId: null,
      claimedAt: null,
      startedAt: "2026-03-24T00:00:00.000Z",
      completedAt: "2026-03-24T00:05:30.000Z",
      errorMessage: null,
      debateState: {
        agreedPoints: [],
        activeConflicts: [],
        pendingQuestions: []
      },
      mcpCalls: 4,
      skillUses: 2,
      webSearches: 3,
      totalPromptTokens: 120,
      totalCompletionTokens: 45,
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: "2026-03-24T00:05:30.000Z"
    };

    const usage: UsageSummary = {
      totalPromptTokens: 120,
      totalCompletionTokens: 45
    };

    expect(
      calculateSessionActivityMetrics({
        run,
        usage
      })
    ).toEqual({
      mcpCalls: 4,
      skillUses: 2,
      webSearches: 3,
      inputTokens: 120,
      outputTokens: 45,
      workDurationMs: 330000
    });
  });

  it("uses current time for running sessions instead of stale updated timestamps", () => {
    const run: SessionRunRecord = {
      id: "run-2",
      sessionId: "session-2",
      status: "running",
      workerId: null,
      claimedAt: null,
      startedAt: "2026-03-24T00:00:00.000Z",
      completedAt: null,
      errorMessage: null,
      debateState: {
        agreedPoints: [],
        activeConflicts: [],
        pendingQuestions: []
      },
      mcpCalls: 1,
      skillUses: 0,
      webSearches: 1,
      totalPromptTokens: 10,
      totalCompletionTokens: 4,
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: "2026-03-24T00:00:10.000Z"
    };

    expect(
      calculateSessionActivityMetrics({
        run,
        usage: {
          totalPromptTokens: 10,
          totalCompletionTokens: 4
        },
        currentTime: "2026-03-24T00:02:00.000Z"
      }).workDurationMs
    ).toBe(120000);
  });
});
