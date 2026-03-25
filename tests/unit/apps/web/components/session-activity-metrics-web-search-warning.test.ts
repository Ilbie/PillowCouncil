import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SessionActivityMetricsCard } from "../../../../../apps/web/components/council/SessionActivityMetricsCard";
import { getUiCopy } from "../../../../../apps/web/lib/i18n";
import type { SessionDetailResponse } from "../../../../../packages/shared/src/types";

const copy = getUiCopy("ko");

function createDetail(overrides?: Partial<SessionDetailResponse>): SessionDetailResponse {
  return {
    session: {
      id: "session-1",
      title: "검색 테스트 세션",
      prompt: "최신 경쟁사 동향을 비교해줘",
      presetId: "custom",
      customPreset: null,
      provider: "openai",
      model: "gpt-5",
      enableWebSearch: true,
      thinkingIntensity: "balanced",
      debateIntensity: 1,
      roundCount: 4,
      language: "ko",
      status: "completed",
      currentRunId: "run-1",
      createdAt: "2026-03-26T00:00:00.000Z",
      updatedAt: "2026-03-26T00:00:10.000Z"
    },
    run: {
      id: "run-1",
      sessionId: "session-1",
      status: "completed",
      workerId: null,
      claimedAt: null,
      startedAt: "2026-03-26T00:00:00.000Z",
      completedAt: "2026-03-26T00:00:10.000Z",
      errorMessage: null,
      debateState: {
        agreedPoints: [],
        activeConflicts: [],
        pendingQuestions: [],
        alignmentScore: 10,
        deviationWarning: null
      },
      mcpCalls: 0,
      skillUses: 0,
      webSearches: 0,
      totalPromptTokens: 10,
      totalCompletionTokens: 12,
      createdAt: "2026-03-26T00:00:00.000Z",
      updatedAt: "2026-03-26T00:00:10.000Z"
    },
    rounds: [],
    decision: null,
    todos: [],
    usage: {
      totalPromptTokens: 10,
      totalCompletionTokens: 12
    },
    activityMetrics: {
      mcpCalls: 0,
      skillUses: 0,
      webSearches: 0,
      inputTokens: 10,
      outputTokens: 12,
      workDurationMs: 10_000
    },
    ...overrides
  };
}

describe("SessionActivityMetricsCard web search warning", () => {
  it("shows a warning when web search was enabled but no web search tool call was used", () => {
    const html = renderToStaticMarkup(
      React.createElement(SessionActivityMetricsCard, {
        detail: createDetail(),
        uiLocale: "ko"
      })
    );

    expect(html).toContain(copy.session.webSearchUnusedWarning);
  });
});
