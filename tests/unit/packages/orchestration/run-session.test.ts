import { describe, expect, it, vi } from "vitest";

import type { CouncilProvider } from "@ship-council/providers";
import {
  parseRebuttalTargetHeader,
  type DebateState,
  type PresetDefinition,
  type RunStreamEvent,
  type SessionRecord
} from "@ship-council/shared";

import { runCouncilSession } from "@ship-council/orchestration";

function createSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  const customPreset: PresetDefinition = {
    id: "custom:test-panel",
    name: "Test Panel",
    description: "A test preset",
    agents: [
      {
        key: "pm",
        name: "PM",
        role: "Product Manager",
        goal: "Drive the roadmap",
        bias: "Customer value",
        style: "Direct",
        systemPrompt: "Argue from a product strategy perspective."
      },
      {
        key: "skeptic",
        name: "Skeptic",
        role: "Risk Reviewer",
        goal: "Challenge assumptions",
        bias: "Execution risk",
        style: "Critical",
        systemPrompt: "Pressure-test hidden risks and weak evidence."
      }
    ]
  };

  return {
    id: "session-1",
    title: "Launch Decision",
    prompt: "Should we launch the feature this quarter?",
    presetId: customPreset.id,
    customPreset,
    provider: "openai",
    model: "gpt-4.1",
    enableWebSearch: false,
    thinkingIntensity: "balanced",
    debateIntensity: 1,
    roundCount: 4,
    language: "en",
    status: "running",
    currentRunId: null,
    createdAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z",
    ...overrides
  };
}

function createProvider() {
  const textInputs: Parameters<CouncilProvider["generateText"]>[0][] = [];
  const jsonInputs: Parameters<CouncilProvider["generateJson"]>[0][] = [];
  const generateText = vi.fn(async (input: Parameters<CouncilProvider["generateText"]>[0]) => {
    textInputs.push(input);
    await input.onTextDelta?.("partial", `draft:${input.prompt.slice(0, 18)}`);
    await input.onReasoningDelta?.("why", `reason:${input.prompt.slice(0, 14)}`);

    const text = input.prompt.includes("attack")
      ? "This rebuttal highlights a brittle assumption."
      : "We should launch with a guarded rollout.";

    return {
      id: `text-${generateText.mock.calls.length}`,
      text,
      usage: {
        promptTokens: 1,
        completionTokens: 2
      }
    };
  });

  async function generateJson<T>(
    input: Parameters<CouncilProvider["generateJson"]>[0] & { schema: Parameters<CouncilProvider["generateJson"]>[0]["schema"] }
  ): Promise<{ data: T; raw: string; usage: { promptTokens: number; completionTokens: number } }> {
    jsonInputs.push(input);
    if (input.system.includes("compact JSON whiteboard")) {
      return {
        data: input.schema.parse({
          agreedPoints: ["Launch needs guardrails"],
          activeConflicts: ["Support cost is still unclear"],
          pendingQuestions: ["Can onboarding absorb the extra load?"]
        }) as T,
        raw: "{}",
        usage: {
          promptTokens: 2,
          completionTokens: 1
        }
      };
    }

    if (input.system.includes("route one rebuttal turn")) {
      return {
        data: input.schema.parse({
          targetAgentKey: "pm",
          weakestClaim: "Guardrails alone are enough",
          attackPoint: "Question whether the rollout plan covers support debt"
        }) as T,
        raw: "{}",
        usage: {
          promptTokens: 4,
          completionTokens: 1
        }
      };
    }

    if (input.system.includes("Ship Council moderator")) {
      return {
        data: input.schema.parse({
          keyPoints: ["The team wants a launch", "Support readiness is the main concern"],
          agreements: ["A guarded rollout is necessary"],
          disagreements: ["Whether support can absorb the workload"],
          risks: ["Support queue saturation"],
          summary: "The panel supports launching only with operational guardrails."
        }) as T,
        raw: "{}",
        usage: {
          promptTokens: 6,
          completionTokens: 2
        }
      };
    }

    return {
      data: input.schema.parse({
        topRecommendation: "Launch behind guardrails this quarter.",
        risks: ["Support demand may spike unexpectedly."],
        finalSummary: "Proceed with a phased rollout and explicit support monitoring."
      }) as T,
      raw: "{}",
      usage: {
        promptTokens: 7,
        completionTokens: 3
      }
    };
  }

  return {
    generateText,
    generateJson,
    textInputs,
    jsonInputs
  };
}

describe("runCouncilSession", () => {
  it("preserves debate stage order, global round numbers, and usage accounting", async () => {
    const provider = createProvider();
    const streamEvents: RunStreamEvent[] = [];

    const result = await runCouncilSession({
      session: createSession(),
      runId: "run-1",
      provider,
      callbacks: {
        onStreamEvent(event) {
          streamEvents.push(event);
        }
      },
      retrieveMemories() {
        return [];
      }
    });

    expect(result.rounds.map((round) => [round.stage, round.roundNumber, round.title])).toEqual([
      ["opening", 1, "Opinion 1"],
      ["rebuttal", 2, "Rebuttal 1"],
      ["summary", 3, "Moderator Summary"],
      ["final", 4, "Final Recommendation"]
    ]);
    expect(result.rounds.flatMap((round) => round.messages.map((message) => message.kind))).toEqual([
      "opinion",
      "opinion",
      "rebuttal",
      "rebuttal",
      "summary",
      "final"
    ]);
    expect(result.usage).toEqual({
      totalPromptTokens: 31,
      totalCompletionTokens: 18
    });
    expect(result.decision).toMatchObject({
      topRecommendation: "Launch behind guardrails this quarter.",
      finalSummary: "Proceed with a phased rollout and explicit support monitoring."
    });
    expect(streamEvents.filter((event) => event.type === "status")).toHaveLength(5);
    expect(streamEvents.filter((event) => event.type === "message-complete")).toHaveLength(4);
  });

  it("adds rebuttal target headers and fires persistence callbacks for each produced message", async () => {
    const provider = createProvider();
    const createdMessages: string[] = [];
    const usageEvents: Array<{ promptTokens: number; completionTokens: number }> = [];
    const debateStates: DebateState[] = [];

    const result = await runCouncilSession({
      session: createSession(),
      runId: "run-2",
      provider,
      callbacks: {
        onMessageCreated(message) {
          createdMessages.push(message.kind);
        },
        onUsage(usage) {
          usageEvents.push(usage);
        },
        onDebateStateUpdated(state) {
          debateStates.push(state);
        }
      },
      assertActive: vi.fn(),
      retrieveMemories() {
        return [];
      }
    });

    const rebuttalMessages = result.rounds.find((round) => round.stage === "rebuttal")?.messages ?? [];
    expect(rebuttalMessages).toHaveLength(2);
    expect(parseRebuttalTargetHeader(rebuttalMessages[0]!.content).metadata).toMatchObject({
      targetAgentKey: "skeptic",
      targetAgentName: "Skeptic"
    });
    expect(parseRebuttalTargetHeader(rebuttalMessages[1]!.content).metadata).toMatchObject({
      targetAgentKey: "pm",
      targetAgentName: "PM"
    });
    expect(createdMessages).toEqual(["opinion", "opinion", "rebuttal", "rebuttal", "summary", "final"]);
    expect(usageEvents).toHaveLength(7);
    expect(debateStates).toHaveLength(3);
  });

  it("forwards the session web search flag only to debate generation calls", async () => {
    const provider = createProvider();

    await runCouncilSession({
      session: createSession({ enableWebSearch: true }),
      runId: "run-3",
      provider,
      retrieveMemories() {
        return [];
      }
    });

    expect(provider.textInputs.length).toBeGreaterThan(0);
    expect(provider.jsonInputs.length).toBeGreaterThan(0);
    expect(provider.textInputs.every((input) => input.enableWebSearch === true)).toBe(true);
    expect(provider.jsonInputs.every((input) => input.enableWebSearch !== true)).toBe(true);
  });
});
