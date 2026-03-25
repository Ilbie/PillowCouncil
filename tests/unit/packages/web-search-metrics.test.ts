import { describe, expect, it } from "vitest";

import { calculateSessionActivityMetrics, createEmptyDebateState, type SessionRunRecord, type UsageSummary } from "../../../packages/shared/src/types";

describe("web search activity metrics", () => {
  it("surfaces run.webSearches directly into activityMetrics.webSearches", () => {
    const run: SessionRunRecord = {
      id: "run-1",
      sessionId: "session-1",
      status: "running",
      workerId: null,
      claimedAt: null,
      errorMessage: null,
      debateState: createEmptyDebateState(),
      totalPromptTokens: 12,
      totalCompletionTokens: 8,
      mcpCalls: 0,
      skillUses: 0,
      webSearches: 1,
      startedAt: "2026-03-26T00:00:00.000Z",
      completedAt: null,
      createdAt: "2026-03-26T00:00:00.000Z",
      updatedAt: "2026-03-26T00:00:05.000Z"
    };
    const usage: UsageSummary = {
      totalPromptTokens: 12,
      totalCompletionTokens: 8
    };

    const metrics = calculateSessionActivityMetrics({
      run,
      usage,
      currentTime: "2026-03-26T00:00:05.000Z"
    });

    expect(metrics.webSearches).toBe(1);
    expect(metrics.inputTokens).toBe(12);
    expect(metrics.outputTokens).toBe(8);
  });
});
