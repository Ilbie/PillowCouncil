import { describe, expect, it } from "vitest";

import type { CouncilProvider, ProviderUsage } from "../../../../packages/providers/src/runtime";
import { runCouncilSession } from "../../../../packages/orchestration/src/run-session";
import type { AgentDefinition, MessageRecord, SessionRecord } from "../../../../packages/shared/src/types";

const usage: ProviderUsage = {
  promptTokens: 0,
  completionTokens: 0,
  mcpCalls: 0,
  skillUses: 0,
  webSearches: 0
};

const agents: AgentDefinition[] = [
  {
    key: "staff-engineer",
    name: "Staff Engineer",
    role: "Engineer",
    goal: "Pressure-test the topic",
    bias: "Operational reliability",
    style: "Direct",
    systemPrompt: "You are a staff engineer who focuses on architecture and implementation risk."
  },
  {
    key: "growth",
    name: "Growth",
    role: "Growth Strategist",
    goal: "Find market upside",
    bias: "Distribution",
    style: "Commercial",
    systemPrompt: "You focus on market pull, growth loops, and channel strategy."
  },
  {
    key: "skeptic",
    name: "Skeptic",
    role: "Skeptic",
    goal: "Find weak assumptions",
    bias: "Risk reduction",
    style: "Sharp",
    systemPrompt: "You challenge overconfidence and expose weak assumptions."
  }
];

function createSession(): SessionRecord {
  return {
    id: "session-agentic",
    title: "IMF panel",
    prompt: "한국 IMF 가능성을 어떻게 평가해야 하나?",
    presetId: "saas-founder",
    customPreset: {
      id: "saas-founder",
      name: "SaaS Founder",
      description: "runtime test preset",
      agents
    },
    provider: "mock-provider",
    model: "mock-model",
    enableWebSearch: true,
    thinkingIntensity: "balanced",
    debateIntensity: 1,
    roundCount: 4,
    language: "ko",
    status: "queued",
    currentRunId: null,
    createdAt: "2026-03-26T00:00:00.000Z",
    updatedAt: "2026-03-26T00:00:00.000Z"
  };
}

type CallLogEntry = {
  method: "generateJson" | "generateText";
  system: string;
  prompt: string;
  enableWebSearch?: boolean;
};

function createAgenticProvider(callLog: CallLogEntry[]): CouncilProvider {
  let routeInvocation = 0;

  return {
    async generateText(input) {
      callLog.push({
        method: "generateText",
        system: input.system,
        prompt: input.prompt,
        enableWebSearch: input.enableWebSearch
      });

      if (input.system.includes("Run a short research phase before the agent speaks")) {
        return {
          id: `research-${callLog.length}`,
          text: "Research notes:\n- IMF stress depends on FX reserves, short-term debt, and policy credibility.\n- Edge-case software architecture details are not decision-critical here.",
          usage: {
            ...usage,
            webSearches: 1
          }
        };
      }

      return {
        id: `text-${callLog.length}`,
        text: "A grounded debate contribution.",
        usage
      };
    },
    async generateJson(input) {
      callLog.push({
        method: "generateJson",
        system: input.system,
        prompt: input.prompt,
        enableWebSearch: input.enableWebSearch
      });

      if (input.prompt.includes('"compiledAgents"')) {
        const compiled = {
          compiledPresetName: "Macroeconomic Crisis Panel",
          compiledPresetDescription: "주제에 맞게 경제 전문가 관점으로 재구성된 패널",
          compiledAgents: [
            {
              key: "staff-engineer",
              name: "Macroeconomic Systems Analyst",
              role: "경제 시스템 분석가",
              goal: "금융 시스템 취약성과 연쇄 리스크를 평가한다.",
              bias: "구조적 취약점과 전염 경로를 우선 본다.",
              style: "거시 지표와 구조를 중심으로 명확하게 말한다.",
              systemPrompt: "당신은 거시경제 시스템 분석가다. 외환, 부채, 금융 시스템 취약성을 중심으로 평가한다."
            },
            {
              key: "growth",
              name: "Domestic Demand Strategist",
              role: "내수 전략 분석가",
              goal: "실물경제 충격과 회복 여력을 평가한다.",
              bias: "수요와 심리 지표를 중시한다.",
              style: "정책과 수요를 실용적으로 연결한다.",
              systemPrompt: "당신은 내수 전략 분석가다. 소비, 투자, 고용과 정책 여력을 중심으로 판단한다."
            },
            {
              key: "skeptic",
              name: "Crisis Skeptic",
              role: "위기 회의론자",
              goal: "과장된 위기론과 낙관론을 모두 검증한다.",
              bias: "과장과 허점을 경계한다.",
              style: "데이터 없는 주장을 짧고 날카롭게 반박한다.",
              systemPrompt: "당신은 위기 회의론자다. IMF 가능성에 대한 과장과 허점을 집요하게 검증한다."
            }
          ]
        };

        return {
          data: input.schema.parse(compiled),
          raw: JSON.stringify(compiled),
          usage
        };
      }

      if (
        input.prompt.includes('{"agreedPoints":[],"activeConflicts":[],"pendingQuestions":[]}') ||
        input.prompt.includes('"alignmentScore":10')
      ) {
        const debateState = {
          agreedPoints: ["핵심 주제는 IMF 가능성의 구조적 평가다."],
          activeConflicts: ["대외 충격이 실제 위기로 전이될지에 대한 해석이 다르다."],
          pendingQuestions: ["정책 대응 여력이 얼마나 남아 있는가?"],
          alignmentScore: 4,
          deviationWarning: "패널이 기술적 구현 세부사항으로 벗어나고 있다. 거시경제 핵심 질문으로 복귀해야 한다."
        };

        return {
          data: input.schema.parse(debateState),
          raw: JSON.stringify(debateState),
          usage
        };
      }

      if (input.prompt.includes('"shouldResearch":false')) {
        const researchPlan = {
          shouldResearch: true,
          focus: "외환보유액, 단기외채, 정책 신뢰도",
          query: "2026 Korea FX reserves short-term external debt IMF risk official sources",
          reason: "최신 거시지표가 있어야 발언을 근거 기반으로 만들 수 있다."
        };

        return {
          data: input.schema.parse(researchPlan),
          raw: JSON.stringify(researchPlan),
          usage
        };
      }

      if (input.prompt.includes('"shouldContinue":true')) {
        routeInvocation += 1;

        const routePlan =
          routeInvocation === 1
            ? {
                shouldContinue: true,
                nextSpeakerKey: "staff-engineer",
                reason: "금융 시스템 취약성 관점이 먼저 필요하다.",
                suggestedTargetAgentKey: null
              }
            : routeInvocation === 2
              ? {
                  shouldContinue: true,
                  nextSpeakerKey: "skeptic",
                  reason: "첫 주장에 대한 반론이 필요하다.",
                  suggestedTargetAgentKey: "staff-engineer"
                }
              : {
                  shouldContinue: false,
                  nextSpeakerKey: null,
                  reason: "이번 단계에서 필요한 핵심 쟁점은 이미 드러났다.",
                  suggestedTargetAgentKey: null
                };

        return {
          data: input.schema.parse(routePlan),
          raw: JSON.stringify(routePlan),
          usage
        };
      }

      if (input.prompt.includes('{"targetAgentKey":"","weakestClaim":"","attackPoint":""}')) {
        const rebuttalTarget = {
          targetAgentKey: "staff-engineer",
          weakestClaim: "외환과 부채 지표만으로 위기 가능성을 충분히 설명했다는 주장",
          attackPoint: "정책 대응과 금융시장 심리 변수까지 보강하라고 요구한다."
        };

        return {
          data: input.schema.parse(rebuttalTarget),
          raw: JSON.stringify(rebuttalTarget),
          usage
        };
      }

      if (input.prompt.includes('{"keyPoints":[],"agreements":[],"disagreements":[],"risks":[],"summary":""}')) {
        const moderatorSummary = {
          keyPoints: ["거시 지표와 정책 대응 여력이 핵심 판단축이다.", "기술 구현 디테일은 논점에서 제외되었다."],
          agreements: ["거시경제 핵심 질문으로 복귀해야 한다."],
          disagreements: ["대외 충격의 전이 가능성 평가가 다르다."],
          risks: ["심리 악화가 위기를 증폭시킬 수 있다."],
          summary: "패널은 IMF 가능성 논의를 거시경제 구조와 정책 대응으로 재정렬했다."
        };

        return {
          data: input.schema.parse(moderatorSummary),
          raw: JSON.stringify(moderatorSummary),
          usage
        };
      }

      const finalDecision = {
        topRecommendation: "IMF 가능성은 단정하지 말고 외환·부채·정책 신뢰도 지표를 함께 점검해야 한다.",
        risks: ["시장 심리 악화가 실제 리스크를 키울 수 있다."],
        finalSummary: "패널은 최신 지표를 바탕으로 거시경제 구조를 평가해야 한다는 결론에 도달했다."
      };

      return {
        data: input.schema.parse(finalDecision),
        raw: JSON.stringify(finalDecision),
        usage
      };
    }
  };
}

describe("agentic orchestration improvements", () => {
  it("compiles runtime personas before the first speaker turn and uses compiled personas in messages", async () => {
    const callLog: CallLogEntry[] = [];

    const result = await runCouncilSession({
      session: createSession(),
      runId: "run-compile",
      provider: createAgenticProvider(callLog)
    });

    expect(callLog[0]?.prompt).toContain('"compiledAgents"');
    expect(result.rounds[0]?.messages[0]?.agentName).toBe("Macroeconomic Systems Analyst");
  });

  it("injects a system intervention message when the debate drifts off-topic", async () => {
    const createdMessages: MessageRecord[] = [];

    await runCouncilSession({
      session: createSession(),
      runId: "run-intervention",
      provider: createAgenticProvider([]),
      callbacks: {
        onMessageCreated(message) {
          createdMessages.push(message);
        }
      }
    });

    expect(
      createdMessages.some(
        (message) =>
          message.role === "system" && String(message.kind) === "intervention" && message.content.includes("거시경제 핵심 질문")
      )
    ).toBe(true);
  });

  it("routes only the moderator-selected subset of speakers instead of forcing every agent to speak", async () => {
    const result = await runCouncilSession({
      session: createSession(),
      runId: "run-routing",
      provider: createAgenticProvider([])
    });

    const openingRound = result.rounds.find((round) => round.stage === "opening");
    const rebuttalRound = result.rounds.find((round) => round.stage === "rebuttal");

    expect(openingRound?.messages.filter((message) => message.role === "agent").map((message) => message.agentKey)).toEqual(["staff-engineer"]);
    expect(rebuttalRound?.messages.filter((message) => message.role === "agent").map((message) => message.agentKey)).toEqual(["skeptic"]);
  });

  it("runs a research phase before speaking and grounds the speaking prompt with research notes", async () => {
    const callLog: CallLogEntry[] = [];

    await runCouncilSession({
      session: createSession(),
      runId: "run-research",
      provider: createAgenticProvider(callLog)
    });

    const researchCallIndex = callLog.findIndex((entry) =>
      entry.system.includes("Run a short research phase before the agent speaks")
    );
    const speechCallIndex = callLog.findIndex((entry) =>
      entry.method === "generateText" && entry.prompt.includes("Research notes:")
    );

    expect(researchCallIndex).toBeGreaterThanOrEqual(0);
    expect(speechCallIndex).toBeGreaterThan(researchCallIndex);
  });
});
