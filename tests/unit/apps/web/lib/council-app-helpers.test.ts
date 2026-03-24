import { describe, expect, it } from "vitest";

import {
  clampDebateIntensity,
  isMatchingSessionRunEvent,
  filterLiveMessagesForSessionRun,
  getThinkingIntensityLabel,
  reconcileConnection,
  removeLiveMessagesForSession,
  type ConnectionDraft,
  type LiveMessageMap
} from "../../../../../apps/web/lib/council-app-helpers.ts";

describe("council-app-helpers", () => {
  it("filters live messages to the matching session run while keeping other sessions", () => {
    const messages: LiveMessageMap = {
      keepOther: {
        id: "msg-1",
        sessionId: "session-other",
        runId: "run-other",
        roundId: "round-1",
        stage: "opening",
        agentKey: "agent-a",
        agentName: "Agent A",
        role: "agent",
        kind: "opinion",
        targetAgentKey: null,
        content: "other",
        reasoning: "",
        createdAt: "2026-03-23T00:00:00.000Z",
        status: "complete"
      },
      keepSameRun: {
        id: "msg-2",
        sessionId: "session-1",
        runId: "run-1",
        roundId: "round-1",
        stage: "opening",
        agentKey: "agent-a",
        agentName: "Agent A",
        role: "agent",
        kind: "opinion",
        targetAgentKey: null,
        content: "same-run",
        reasoning: "",
        createdAt: "2026-03-23T00:00:00.000Z",
        status: "complete"
      },
      dropDifferentRun: {
        id: "msg-3",
        sessionId: "session-1",
        runId: "run-2",
        roundId: "round-2",
        stage: "rebuttal",
        agentKey: "agent-b",
        agentName: "Agent B",
        role: "agent",
        kind: "rebuttal",
        targetAgentKey: "agent-a",
        content: "different-run",
        reasoning: "",
        createdAt: "2026-03-23T00:00:00.000Z",
        status: "streaming"
      }
    };

    expect(filterLiveMessagesForSessionRun(messages, "session-1", "run-1")).toEqual({
      keepOther: messages.keepOther,
      keepSameRun: messages.keepSameRun
    });
  });

  it("removes all live messages for a session", () => {
    const messages: LiveMessageMap = {
      keep: {
        id: "msg-1",
        sessionId: "session-2",
        runId: "run-2",
        roundId: "round-1",
        stage: "opening",
        agentKey: "agent-a",
        agentName: "Agent A",
        role: "agent",
        kind: "opinion",
        targetAgentKey: null,
        content: "keep",
        reasoning: "",
        createdAt: "2026-03-23T00:00:00.000Z",
        status: "complete"
      },
      remove: {
        id: "msg-2",
        sessionId: "session-1",
        runId: "run-1",
        roundId: "round-1",
        stage: "opening",
        agentKey: "agent-b",
        agentName: "Agent B",
        role: "agent",
        kind: "opinion",
        targetAgentKey: null,
        content: "remove",
        reasoning: "",
        createdAt: "2026-03-23T00:00:00.000Z",
        status: "complete"
      }
    };

    expect(removeLiveMessagesForSession(messages, "session-1")).toEqual({
      keep: messages.keep
    });
  });

  it("matches stream events when both session and run match", () => {
    expect(
      isMatchingSessionRunEvent(
        {
          sessionId: "session-1",
          runId: "run-1"
        } as const,
        "session-1",
        "run-1"
      )
    ).toBe(true);
  });

  it("does not match stream events when session id differs", () => {
    expect(
      isMatchingSessionRunEvent(
        {
          sessionId: "session-2",
          runId: "run-1"
        } as const,
        "session-1",
        "run-1"
      )
    ).toBe(false);
  });

  it("does not match stream events when run id differs", () => {
    expect(
      isMatchingSessionRunEvent(
        {
          sessionId: "session-1",
          runId: "run-2"
        } as const,
        "session-1",
        "run-1"
      )
    ).toBe(false);
  });

  it("does not match when active run is null", () => {
    expect(
      isMatchingSessionRunEvent(
        {
          sessionId: "session-1",
          runId: "run-1"
        } as const,
        "session-1",
        null
      )
    ).toBe(false);
  });

  it("reconciles provider and auth mode against the catalog", () => {
    const current: ConnectionDraft = {
      providerId: "missing",
      authMode: "missing",
      apiKey: "secret"
    };

    expect(
      reconcileConnection(
        [
          {
            id: "provider-a",
            label: "Provider A",
            description: "Provider A",
            npmPackage: "pkg",
            connected: true,
            authModes: [
              { id: "oauth:provider-a", label: "OAuth", type: "oauth", methodIndex: 0, description: "OAuth", envKeys: [] },
              { id: "api:provider-a", label: "API Key", type: "api", methodIndex: 1, description: "API", envKeys: [] }
            ],
            models: []
          }
        ],
        current,
        { providerId: "provider-a", authMode: "oauth:provider-a" }
      )
    ).toEqual({
      providerId: "provider-a",
      authMode: "oauth:provider-a",
      apiKey: "secret"
    });
  });

  it("clamps debate intensity to the supported range", () => {
    expect(clampDebateIntensity(Number.NaN)).toBe(2);
    expect(clampDebateIntensity(0)).toBe(1);
    expect(clampDebateIntensity(99)).toBe(20);
    expect(clampDebateIntensity(3.8)).toBe(3);
  });

  it("formats thinking intensity labels by locale", () => {
    expect(getThinkingIntensityLabel("deep", "ko")).toBe("깊게");
    expect(getThinkingIntensityLabel("medium", "ja")).toBe("中間");
    expect(getThinkingIntensityLabel("balanced", "en")).toBe("Balanced");
  });
});
