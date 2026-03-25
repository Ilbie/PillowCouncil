import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SessionSidebar } from "../../../../../apps/web/components/council/SessionSidebar";
import { getUiCopy } from "../../../../../apps/web/lib/i18n";

const copy = getUiCopy("ko");

function renderSidebar() {
  return renderToStaticMarkup(
    React.createElement(SessionSidebar, {
      copy,
      uiLocale: "ko",
      sessions: [
        {
          session: {
            id: "session_1",
            title: "첫 번째 세션",
            prompt: "기록 관리 흐름을 정리합니다.",
            presetId: "saas-founder",
            customPreset: null,
            provider: "openai",
            model: "gpt-4.1",
            enableWebSearch: false,
            thinkingIntensity: "balanced",
            debateIntensity: 2,
            roundCount: 4,
            language: "ko",
            status: "completed",
            currentRunId: null,
            createdAt: "2026-03-25T00:00:00.000Z",
            updatedAt: "2026-03-25T00:00:00.000Z"
          },
          run: null
        }
      ],
      totalSessionCount: 3,
      selectedId: "session_1",
      activeRunSessionId: null,
      isLoadingMore: false,
      deletingSessionId: null,
      onOpenCreateSession: () => undefined,
      onSelectSession: () => undefined,
      onLoadMoreSessions: () => undefined,
      onDeleteSession: () => undefined
    })
  );
}

describe("SessionSidebar history controls", () => {
  it("renders delete and load-more affordances when there are more saved sessions", () => {
    const markup = renderSidebar();

    expect(markup).toContain(copy.sessions.loadMore);
    expect(markup).toContain(copy.sessions.delete);
  });
});
