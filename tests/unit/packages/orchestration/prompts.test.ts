import { describe, expect, it } from "vitest";

import type { AgentDefinition, MemorySearchResult, MessageRecord, SessionRecord } from "@ship-council/shared";

import {
  buildMemoryQuery,
  formatFinalPrompt,
  formatOpinionPrompt,
  formatRebuttalPrompt,
  renderDebateState,
  renderMessages,
  renderRetrievedMemories
} from "@ship-council/orchestration/prompts";

const session: SessionRecord = {
  id: "session-1",
  title: "Debate",
  prompt: "Should we launch the feature this quarter?",
  presetId: "panel:default",
  customPreset: null,
  provider: "openai",
  model: "gpt-4.1",
  thinkingIntensity: "deep",
  debateIntensity: 2,
  roundCount: 6,
  language: "en",
  status: "running",
  currentRunId: "run-1",
  createdAt: "2026-03-23T00:00:00.000Z",
  updatedAt: "2026-03-23T00:00:00.000Z"
};

const agent: AgentDefinition = {
  key: "pm",
  name: "PM",
  role: "Product Manager",
  goal: "Ship the best roadmap",
  bias: "leans toward customer impact",
  style: "concise",
  systemPrompt: "You are a product-minded panelist."
};

const recentMessages: MessageRecord[] = [
  {
    id: "msg-1",
    sessionId: session.id,
    runId: "run-1",
    roundId: "round-1",
    agentKey: "pm",
    agentName: "PM",
    role: "agent",
    kind: "opinion",
    targetAgentKey: null,
    content: "We should launch with a guarded rollout.",
    createdAt: "2026-03-23T00:00:00.000Z"
  }
];

const memories: MemorySearchResult[] = [
  {
    messageId: "msg-9",
    roundId: "round-0",
    roundNumber: 1,
    stage: "opening",
    agentKey: "skeptic",
    agentName: "Skeptic",
    kind: "opinion",
    content: "Past launches failed when onboarding was unclear.",
    createdAt: "2026-03-22T00:00:00.000Z",
    score: 0.91
  }
];

describe("orchestration prompts", () => {
  it("renders messages with kind labels", () => {
    expect(renderMessages(recentMessages)).toContain("[OPINION]");
    expect(renderMessages(recentMessages)).toContain("PM");
  });

  it("renders debate state sections", () => {
    expect(
      renderDebateState({
        agreedPoints: ["users need faster onboarding"],
        activeConflicts: ["support burden is unclear"],
        pendingQuestions: ["can we measure activation quickly?"]
      })
    ).toContain("Agreed points");
  });

  it("renders retrieved memories with stage and round", () => {
    expect(renderRetrievedMemories(memories)).toContain("Round 1 [OPENING]");
  });

  it("builds a deduplicated memory query from session prompt and recent messages", () => {
    const query = buildMemoryQuery(session, recentMessages);
    expect(query).toContain("launch");
    expect(query).toContain("feature");
  });

  it("formats opinion and rebuttal prompts with thinking intensity context", () => {
    const opinion = formatOpinionPrompt({
      session,
      agentName: agent.name,
      cycleNumber: 1,
      debateState: { agreedPoints: [], activeConflicts: [], pendingQuestions: [] },
      recentMessages,
      retrievedMemories: memories
    });

    const rebuttal = formatRebuttalPrompt({
      session,
      agentName: agent.name,
      agentKey: agent.key,
      cycleNumber: 1,
      debateState: { agreedPoints: [], activeConflicts: [], pendingQuestions: [] },
      recentMessages,
      retrievedMemories: memories,
      opinionMessages: recentMessages,
      targetAgentKey: "skeptic",
      targetAgentName: "Skeptic",
      weakestClaim: "launch risk is too high",
      attackPoint: "missing evidence"
    });

    expect(opinion).toContain("Thinking intensity: deep");
    expect(opinion).toContain("PM, write your current position");
    expect(rebuttal).toContain("Target agent name: Skeptic");
    expect(rebuttal).toContain("missing evidence");
  });

  it("formats final prompt with moderator summary JSON", () => {
    const finalPrompt = formatFinalPrompt({
      session,
      debateState: { agreedPoints: [], activeConflicts: [], pendingQuestions: [] },
      recentMessages,
      moderatorSummary: {
        keyPoints: ["guarded rollout"],
        agreements: ["launch behind a flag"],
        disagreements: ["timing"],
        risks: ["support load"],
        summary: "Ship behind a flag and monitor carefully."
      }
    });

    expect(finalPrompt).toContain("# Moderator summary");
    expect(finalPrompt).toContain("support load");
    expect(finalPrompt).toContain('"topRecommendation"');
  });
});
