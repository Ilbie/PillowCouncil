import { describe, expect, it } from "vitest";

import type { CouncilProvider, ProviderUsage } from "../../../../packages/providers/src/runtime";
import { formatAgentSystem, formatFinalPrompt, formatModeratorPrompt, formatOpinionPrompt, formatRebuttalPrompt } from "../../../../packages/orchestration/src/prompts";
import { runCouncilSession } from "../../../../packages/orchestration/src/run-session";
import type { AgentDefinition, SessionRecord } from "../../../../packages/shared/src/types";

const usage: ProviderUsage = {
  promptTokens: 0,
  completionTokens: 0,
  mcpCalls: 0,
  skillUses: 0,
  webSearches: 0
};

const agents: AgentDefinition[] = [
  {
    key: "engineer",
    name: "Staff Engineer",
    role: "Engineer",
    goal: "Pressure-test the plan",
    bias: "Operational reliability",
    style: "Direct and skeptical",
    systemPrompt: "Focus on tradeoffs, execution feasibility, and failure modes while staying useful to the topic."
  },
  {
    key: "strategist",
    name: "Strategist",
    role: "Strategist",
    goal: "Keep the conversation anchored to user value",
    bias: "Business outcomes",
    style: "Structured and pragmatic",
    systemPrompt: "Focus on customer value, positioning, and decision clarity across the debate."
  }
];

function createDebateState() {
  return {
    agreedPoints: [],
    activeConflicts: [],
    pendingQuestions: [],
    alignmentScore: 10,
    deviationWarning: null
  };
}

function createSession(): SessionRecord {
  return {
    id: "session-1",
    title: "Topic guardrail session",
    prompt: "Should Korea launch a new SMB-focused SaaS product this year?",
    presetId: "custom",
    customPreset: {
      id: "custom",
      name: "Custom",
      description: "Custom preset",
      agents
    },
    provider: "mock-provider",
    model: "mock-model",
    enableWebSearch: false,
    thinkingIntensity: "balanced",
    debateIntensity: 1,
    roundCount: 0,
    language: "ko",
    status: "queued",
    currentRunId: null,
    createdAt: "2026-03-25T00:00:00.000Z",
    updatedAt: "2026-03-25T00:00:00.000Z"
  };
}

function createProvider(callLog: Array<{ system: string; prompt: string }>): CouncilProvider {
  return {
    async generateText(input) {
      return {
        id: `text-${callLog.length}`,
        text: `${input.prompt.split("\n")[0]}\nA focused response that stays on the topic.`,
        usage
      };
    },
    async generateJson(input) {
      callLog.push({ system: input.system, prompt: input.prompt });

      if (input.prompt.includes('"compiledAgents"')) {
        const compiledPreset = {
          compiledPresetName: "Custom",
          compiledPresetDescription: "Custom preset",
          compiledAgents: agents
        };

        return {
          data: input.schema.parse(compiledPreset),
          raw: JSON.stringify(compiledPreset),
          usage
        };
      }

      if (input.prompt.includes('{"shouldContinue":true,"nextSpeakerKey":"","reason":"","suggestedTargetAgentKey":null}')) {
        const routePlan = {
          shouldContinue: true,
          nextSpeakerKey: "engineer",
          reason: "Keep the debate focused on the highest-value contribution.",
          suggestedTargetAgentKey: null
        };

        return {
          data: input.schema.parse(routePlan),
          raw: JSON.stringify(routePlan),
          usage
        };
      }

      if (input.prompt.includes('{"shouldResearch":false,"focus":"","query":"","reason":""}')) {
        const researchPlan = {
          shouldResearch: false,
          focus: "",
          query: "",
          reason: ""
        };

        return {
          data: input.schema.parse(researchPlan),
          raw: JSON.stringify(researchPlan),
          usage
        };
      }

      if (input.prompt.includes('{"targetAgentKey":"","weakestClaim":"","attackPoint":""}')) {
        const rebuttalTarget = {
          targetAgentKey: "strategist",
          weakestClaim: "The launch recommendation is still too abstract.",
          attackPoint: "Ask for concrete customer evidence and business impact."
        };

        return {
          data: input.schema.parse(rebuttalTarget),
          raw: JSON.stringify(rebuttalTarget),
          usage
        };
      }

      if (
        input.prompt.includes('{"agreedPoints":[],"activeConflicts":[],"pendingQuestions":[],"alignmentScore":10,"deviationWarning":null}') ||
        input.prompt.includes('{"agreedPoints":[],"activeConflicts":[],"pendingQuestions":[]}')
      ) {
        const debateState = {
          agreedPoints: ["The topic is SMB SaaS launch strategy, not software architecture."],
          activeConflicts: ["Whether demand is strong enough this year."],
          pendingQuestions: ["Which customer segment has the highest urgency?"],
          alignmentScore: 10,
          deviationWarning: null
        };

        return {
          data: input.schema.parse(debateState),
          raw: JSON.stringify(debateState),
          usage
        };
      }

      if (input.prompt.includes('{"keyPoints":[],"agreements":[],"disagreements":[],"risks":[],"summary":""}')) {
        const moderatorSummary = {
          keyPoints: ["The team debated demand and timing.", "Technical edge cases were not the main decision axis."],
          agreements: ["Customer pain and timing matter most."],
          disagreements: ["How strong near-term demand is."],
          risks: [],
          summary: "The debate stayed mostly centered on market opportunity and execution timing."
        };

        return {
          data: input.schema.parse(moderatorSummary),
          raw: JSON.stringify(moderatorSummary),
          usage
        };
      }

      const finalDecision = {
        topRecommendation: "Validate demand with 10 SMB interviews before committing to a full launch.",
        risks: [],
        finalSummary: "The council recommends a demand-validation phase instead of over-indexing on technical edge cases."
      };

      return {
        data: input.schema.parse(finalDecision),
        raw: JSON.stringify(finalDecision),
        usage
      };
    }
  };
}

describe("orchestration prompt guardrails", () => {
  it("adds role adaptation guidance to the agent system prompt", () => {
    const prompt = formatAgentSystem(agents[0], createSession());

    expect(prompt).toContain("IMPORTANT ROLE ADAPTATION");
    expect(prompt).toContain("DO NOT use software engineering jargon");
  });

  it("uses constructive rebuttal wording instead of attack-only framing", () => {
    const prompt = formatRebuttalPrompt({
      session: createSession(),
      agentName: agents[0].name,
      agentKey: agents[0].key,
      cycleNumber: 1,
      debateState: createDebateState(),
      recentMessages: [],
      retrievedMemories: [],
      opinionMessages: [
        {
          id: "message-1",
          sessionId: "session-1",
          runId: "run-1",
          roundId: "round-1",
          agentKey: agents[1].key,
          agentName: agents[1].name,
          role: "agent",
          kind: "opinion",
          targetAgentKey: null,
          content: "We should launch fast because the market window is open.",
          createdAt: "2026-03-25T00:00:00.000Z"
        }
      ],
      targetAgentKey: agents[1].key,
      targetAgentName: agents[1].name,
      weakestClaim: "We should launch fast because the market window is open.",
      attackPoint: "Ask for concrete evidence of demand and user value."
    });

    expect(prompt).toContain("Provide a constructive critique of the target's claim.");
    expect(prompt).toContain("redirect the focus back to the core Topic and business/user value");
    expect(prompt).not.toContain("Attack contradictions, weak assumptions, missing evidence, and execution risk.");
  });

  it("does not force every opinion turn into risk-mining", () => {
    const prompt = formatOpinionPrompt({
      session: createSession(),
      agentName: agents[0].name,
      cycleNumber: 1,
      debateState: createDebateState(),
      recentMessages: [],
      retrievedMemories: []
    });

    expect(prompt).toContain("Stay focused on the core topic and decision");
    expect(prompt).toContain("The most important open question or meaningful risk");
    expect(prompt).not.toContain("The biggest remaining risk");
  });

  it("lets the moderator return no risks when none are material", () => {
    const prompt = formatModeratorPrompt({
      session: createSession(),
      debateState: createDebateState(),
      recentMessages: []
    });

    expect(prompt).toContain("Keep the summary centered on the Original Topic");
    expect(prompt).toContain("If no material risks remain, return an empty risks array.");
  });

  it("anchors the final prompt to the original topic instead of technical tangents", () => {
    const prompt = formatFinalPrompt({
      session: createSession(),
      debateState: createDebateState(),
      recentMessages: [],
      moderatorSummary: {
        keyPoints: ["Market demand matters.", "Implementation details are secondary."],
        agreements: ["Need more customer evidence."],
        disagreements: ["How urgent the window is."],
        risks: ["Demand uncertainty."],
        summary: "The debate focused on market timing."
      }
    });

    expect(prompt).toContain("Ensure the final output directly answers the Original Topic.");
    expect(prompt).toContain("Avoid summarizing minor technical tangents.");
    expect(prompt).toContain("If no material risks remain, return an empty risks array.");
  });

  it("adds topic-guardrail instructions when refreshing debate state", async () => {
    const callLog: Array<{ system: string; prompt: string }> = [];

    await runCouncilSession({
      session: createSession(),
      runId: "run-1",
      provider: createProvider(callLog)
    });

    const refreshCall =
      callLog.find((entry) => entry.system.includes("strictly align the whiteboard with the Original Topic")) ??
      callLog.find((entry) => entry.prompt.includes('"alignmentScore":10'));

    expect(refreshCall).toBeDefined();
    expect(refreshCall?.system).toContain("strictly align the whiteboard with the Original Topic");
    expect(refreshCall?.system).toContain("minor technical implementation details");
  });

  it("softens rebuttal-target selection so it does not optimize for pure attack", async () => {
    const callLog: Array<{ system: string; prompt: string }> = [];

    await runCouncilSession({
      session: createSession(),
      runId: "run-attack-check",
      provider: createProvider(callLog)
    });

    const rebuttalSelectionCall =
      callLog.find((entry) => entry.system.includes("constructive pressure-testing")) ??
      callLog.find((entry) => entry.prompt.includes("Stage: rebuttal"));

    expect(rebuttalSelectionCall).toBeDefined();
    expect(rebuttalSelectionCall?.system ?? rebuttalSelectionCall?.prompt).toContain("materially improve the debate");
  });

  it("allows the final decision schema to accept an empty risk list when the topic is ideation-focused", async () => {
    const result = await runCouncilSession({
      session: createSession(),
      runId: "run-2",
      provider: createProvider([])
    });

    expect(result.decision.risks).toEqual([]);
  });
});
