import { getPresetDefinition } from "@ship-council/agents";
import type { CouncilProvider, ProviderUsage } from "@ship-council/providers";
import { z } from "zod";
import {
  createEmptyDebateState,
  createId,
  debateStateSchema,
  moderatorSummarySchema,
  nowIso,
  prependRebuttalTargetHeader,
  type DebateState,
  type LiveMessageRecord,
  type MemorySearchResult,
  type RebuttalTargetMetadata,
   type AgentDefinition,
    type DecisionSummary,
    type MessageRecord,
    type SessionRecord,
    type UsageSummary
} from "@ship-council/shared";

import {
  formatAgentSystem,
  formatFinalPrompt,
  formatModeratorPrompt,
  formatOpinionPrompt,
  formatRebuttalPrompt,
  getLanguageInstruction,
  getThinkingIntensityInstruction,
  renderMessages,
} from "./prompts";
import { createMessage, createRound } from "./engine/factories";
import { loadRetrievedMemories } from "./engine/memory-loader";
import { persistMessage } from "./engine/message-persistence";
import type { ContextState, OrchestratedRound, RunActivityGuard, RunSessionCallbacks, RunSessionResult } from "./engine/types";

const finalDecisionSchema = z.object({
  topRecommendation: z.string().min(1).max(1000),
  risks: z.array(z.string().min(1)).min(1).max(6),
  finalSummary: z.string().min(1).max(1600)
});
const rebuttalTargetSchema = z.object({
  targetAgentKey: z.string().min(1).max(80),
  weakestClaim: z.string().min(1).max(400),
  attackPoint: z.string().min(1).max(400)
});
type RebuttalTargetPlan = z.output<typeof rebuttalTargetSchema>;

async function refreshDebateState(input: {
  session: SessionRecord;
  provider: CouncilProvider;
  state: ContextState;
  usage: UsageSummary;
  callbacks?: RunSessionCallbacks;
  assertActive?: RunActivityGuard;
}): Promise<void> {
  await input.assertActive?.();

  if (input.state.recentMessages.length === 0) {
    return;
  }

  const response = await input.provider.generateJson({
      provider: input.session.provider,
      model: input.session.model,
      variant: input.session.thinkingIntensity,
      system: [
        "You maintain a compact JSON whiteboard for a long-running debate.",
        "Overwrite the state using only concrete agreements, active conflicts, and unanswered questions.",
        "Avoid duplicates and keep each item short.",
        "Return JSON that matches the schema exactly.",
        getThinkingIntensityInstruction(input.session),
        getLanguageInstruction(input.session)
      ].join("\n"),
    prompt: [
      `Topic: ${input.session.prompt}`,
      `Completed debate cycles so far: ${input.session.debateIntensity}`,
      "",
      "Existing debate whiteboard:",
      JSON.stringify(input.state.debateState, null, 2),
      "",
      "Recent discussion:",
      renderMessages(input.state.recentMessages),
      "",
      'Return JSON matching this shape exactly:',
      '{"agreedPoints":[],"activeConflicts":[],"pendingQuestions":[]}'
    ]
      .filter((value): value is string => Boolean(value))
      .join("\n\n"),
    schema: debateStateSchema,
    retries: 1
  });

  await input.assertActive?.();

  input.usage.totalPromptTokens += response.usage.promptTokens;
  input.usage.totalCompletionTokens += response.usage.completionTokens;
  await input.callbacks?.onUsage?.(response.usage);

  input.state.debateState = response.data;
  await input.callbacks?.onDebateStateUpdated?.(response.data);
}

function buildFallbackRebuttalTarget(agentKey: string, opinionMessages: MessageRecord[]): RebuttalTargetPlan {
  const fallbackMessage = opinionMessages.find((message) => message.agentKey !== agentKey) ?? opinionMessages[0];

  return {
    targetAgentKey: fallbackMessage?.agentKey ?? agentKey,
    weakestClaim: fallbackMessage?.content.split("\n")[0]?.trim() || "The current claim needs stronger evidence.",
    attackPoint: "Attack the weakest assumption, missing evidence, or execution risk in that claim."
  };
}

async function selectRebuttalTarget(input: {
  session: SessionRecord;
  provider: CouncilProvider;
  agent: AgentDefinition;
  cycleNumber: number;
  opinionMessages: MessageRecord[];
  usage: UsageSummary;
  callbacks?: RunSessionCallbacks;
  assertActive?: RunActivityGuard;
}): Promise<RebuttalTargetPlan & { targetAgentName: string }> {
  const fallback = buildFallbackRebuttalTarget(input.agent.key, input.opinionMessages);
  const targetCandidates = input.opinionMessages.filter((message) => message.agentKey !== input.agent.key);

  if (targetCandidates.length === 0) {
    return {
      ...fallback,
      targetAgentName: input.agent.name
    };
  }

  const response = await input.provider.generateJson({
    provider: input.session.provider,
    model: input.session.model,
    variant: input.session.thinkingIntensity,
    system: [
      "You route one rebuttal turn for the Ship Council debate.",
      "Choose exactly one target agent whose current opinion is most worth attacking.",
      "Return only JSON that matches the schema.",
      getThinkingIntensityInstruction(input.session),
      getLanguageInstruction(input.session)
    ].join("\n"),
    prompt: [
      "Select exactly one target agent for this rebuttal.",
      `Topic: ${input.session.prompt}`,
      `Current debate cycle: ${input.cycleNumber} of ${input.session.debateIntensity}`,
      `Rebutting agent key: ${input.agent.key}`,
      `Rebutting agent name: ${input.agent.name}`,
      "Available target agents:",
      ...targetCandidates.map(
        (message) =>
          `- ${message.agentKey} | ${message.agentName} | Claim: ${message.content.split("\n")[0]?.trim() || message.content.trim()}`
      ),
      "Return JSON matching this shape exactly:",
      '{"targetAgentKey":"","weakestClaim":"","attackPoint":""}'
    ].join("\n"),
    schema: rebuttalTargetSchema,
    retries: 1
  });

  await input.assertActive?.();
  input.usage.totalPromptTokens += response.usage.promptTokens;
  input.usage.totalCompletionTokens += response.usage.completionTokens;
  await input.callbacks?.onUsage?.(response.usage);

  const selectedTarget = targetCandidates.find((message) => message.agentKey === response.data.targetAgentKey);
  const plan = selectedTarget ? response.data : fallback;
  const targetMessage = targetCandidates.find((message) => message.agentKey === plan.targetAgentKey) ?? targetCandidates[0];

  return {
    targetAgentKey: targetMessage.agentKey,
    targetAgentName: targetMessage.agentName,
    weakestClaim: plan.weakestClaim,
    attackPoint: plan.attackPoint
  };
}

async function streamMessageGeneration(input: {
  session: SessionRecord;
  round: OrchestratedRound;
  runId: string;
  provider: CouncilProvider;
  callbacks?: RunSessionCallbacks;
  assertActive?: RunActivityGuard;
  agentKey: string;
  agentName: string;
  role: MessageRecord["role"];
  kind: MessageRecord["kind"];
  targetAgentKey?: string;
  rebuttalTarget?: RebuttalTargetMetadata;
  system: string;
  prompt: string;
}): Promise<{ message: MessageRecord; usage: ProviderUsage; reasoning: string }> {
  const liveMessage: LiveMessageRecord = {
    id: createId("message"),
    sessionId: input.session.id,
    runId: input.runId,
    roundId: input.round.id,
    stage: input.round.stage,
    agentKey: input.agentKey,
    agentName: input.agentName,
    role: input.role,
    kind: input.kind,
    targetAgentKey: input.targetAgentKey ?? null,
    content: "",
    reasoning: "",
    createdAt: nowIso(),
    status: "streaming"
  };

  const response = await input.provider.generateText({
    provider: input.session.provider,
    model: input.session.model,
    variant: input.session.thinkingIntensity,
    enableWebSearch: input.session.enableWebSearch,
    system: input.system,
    prompt: input.prompt,
    onTextDelta: async (delta, snapshot) => {
      liveMessage.content = snapshot;
      await input.callbacks?.onStreamEvent?.({
        type: "text-delta",
        sessionId: input.session.id,
        runId: input.runId,
        messageId: liveMessage.id,
        roundId: input.round.id,
        stage: input.round.stage,
        agentKey: input.agentKey,
        agentName: input.agentName,
        role: input.role,
        kind: input.kind,
        targetAgentKey: input.targetAgentKey ?? null,
        delta,
        snapshot,
        createdAt: liveMessage.createdAt
      });
    },
    onReasoningDelta: async (delta, snapshot) => {
      liveMessage.reasoning = snapshot;
      await input.callbacks?.onStreamEvent?.({
        type: "reasoning-delta",
        sessionId: input.session.id,
        runId: input.runId,
        messageId: liveMessage.id,
        roundId: input.round.id,
        stage: input.round.stage,
        agentKey: input.agentKey,
        agentName: input.agentName,
        role: input.role,
        kind: input.kind,
        targetAgentKey: input.targetAgentKey ?? null,
        delta,
        snapshot,
        createdAt: liveMessage.createdAt
      });
    }
  });

  await input.assertActive?.();

  const finalContent = input.kind === "rebuttal" && input.rebuttalTarget
    ? prependRebuttalTargetHeader(response.text, input.rebuttalTarget)
    : response.text;

  const message: MessageRecord = {
    id: liveMessage.id,
    sessionId: input.session.id,
    runId: input.runId,
    roundId: input.round.id,
    agentKey: input.agentKey,
    agentName: input.agentName,
    role: input.role,
    kind: input.kind,
    targetAgentKey: input.targetAgentKey ?? null,
    content: finalContent,
    createdAt: liveMessage.createdAt
  };

  await input.callbacks?.onStreamEvent?.({
    type: "message-complete",
    sessionId: input.session.id,
    runId: input.runId,
    messageId: liveMessage.id,
    roundId: input.round.id,
    stage: input.round.stage,
    agentKey: input.agentKey,
    agentName: input.agentName,
    role: input.role,
    kind: input.kind,
    targetAgentKey: input.targetAgentKey ?? null,
    content: finalContent,
    reasoning: liveMessage.reasoning,
    createdAt: liveMessage.createdAt
  });

  return {
    message,
    usage: response.usage,
    reasoning: liveMessage.reasoning
  };
}

export async function runCouncilSession(input: {
  session: SessionRecord;
  runId: string;
  provider: CouncilProvider;
  callbacks?: RunSessionCallbacks;
  assertActive?: RunActivityGuard;
  retrieveMemories?: (input: {
    session: SessionRecord;
    runId: string;
    agentKey: string;
    agentName: string;
    kind: MessageRecord["kind"];
    query: string;
    excludeMessageIds: string[];
  }) => Promise<MemorySearchResult[]> | MemorySearchResult[];
}): Promise<RunSessionResult> {
  const preset = input.session.customPreset ?? getPresetDefinition(input.session.presetId);
  if (!preset) {
    throw new Error(`Unknown preset: ${input.session.presetId}`);
  }

  const rounds: OrchestratedRound[] = [];
  const usage: UsageSummary = {
    totalPromptTokens: 0,
    totalCompletionTokens: 0
  };
  const contextState: ContextState = {
    debateState: createEmptyDebateState(),
    recentMessages: []
  };

  await input.callbacks?.onStreamEvent?.({
    type: "status",
    sessionId: input.session.id,
    runId: input.runId,
    status: "run-started",
    stage: null,
    createdAt: nowIso()
  });

  let roundNumber = 1;

  for (let cycleNumber = 1; cycleNumber <= input.session.debateIntensity; cycleNumber += 1) {
    await refreshDebateState({
      session: input.session,
      provider: input.provider,
      state: contextState,
      usage,
      callbacks: input.callbacks,
      assertActive: input.assertActive
    });

    await input.assertActive?.();

    const opinionRound: OrchestratedRound = {
      ...createRound(input.session.id, input.runId, roundNumber, "opening", `Opinion ${cycleNumber}`),
      messages: []
    };
    roundNumber += 1;
    rounds.push(opinionRound);
    await input.callbacks?.onRoundCreated?.(opinionRound);
    await input.callbacks?.onStreamEvent?.({
      type: "status",
      sessionId: input.session.id,
      runId: input.runId,
      status: "round-started",
      stage: opinionRound.stage,
      roundId: opinionRound.id,
      title: opinionRound.title,
      createdAt: opinionRound.createdAt
    });

    for (const agent of preset.agents) {
      await input.assertActive?.();

      const retrievedMemories = await loadRetrievedMemories({
        session: input.session,
        runId: input.runId,
        agentKey: agent.key,
        agentName: agent.name,
        kind: "opinion",
        state: contextState,
        retrieveMemories: input.retrieveMemories
      });

      const generated = await streamMessageGeneration({
        session: input.session,
        round: opinionRound,
        runId: input.runId,
        provider: input.provider,
        callbacks: input.callbacks,
        assertActive: input.assertActive,
        agentKey: agent.key,
        agentName: agent.name,
        role: "agent",
        kind: "opinion",
        system: formatAgentSystem(agent, input.session),
        prompt: formatOpinionPrompt({
          session: input.session,
          agentName: agent.name,
          cycleNumber,
          debateState: contextState.debateState,
          recentMessages: contextState.recentMessages,
          retrievedMemories
        })
      });

      await persistMessage({
        round: opinionRound,
        state: contextState,
        usage,
        callbacks: input.callbacks,
        message: generated.message,
        usageDelta: generated.usage
      });
    }

    await refreshDebateState({
      session: input.session,
      provider: input.provider,
      state: contextState,
      usage,
      callbacks: input.callbacks,
      assertActive: input.assertActive
    });

    await input.assertActive?.();

    const rebuttalRound: OrchestratedRound = {
      ...createRound(input.session.id, input.runId, roundNumber, "rebuttal", `Rebuttal ${cycleNumber}`),
      messages: []
    };
    roundNumber += 1;
    rounds.push(rebuttalRound);
    await input.callbacks?.onRoundCreated?.(rebuttalRound);
    await input.callbacks?.onStreamEvent?.({
      type: "status",
      sessionId: input.session.id,
      runId: input.runId,
      status: "round-started",
      stage: rebuttalRound.stage,
      roundId: rebuttalRound.id,
      title: rebuttalRound.title,
      createdAt: rebuttalRound.createdAt
    });

    for (const agent of preset.agents) {
      await input.assertActive?.();

      const rebuttalTarget = await selectRebuttalTarget({
        session: input.session,
        provider: input.provider,
        agent,
        cycleNumber,
        opinionMessages: opinionRound.messages,
        usage,
        callbacks: input.callbacks,
        assertActive: input.assertActive
      });

      const retrievedMemories = await loadRetrievedMemories({
        session: input.session,
        runId: input.runId,
        agentKey: agent.key,
        agentName: agent.name,
        kind: "rebuttal",
        state: contextState,
        retrieveMemories: input.retrieveMemories
      });

      const generated = await streamMessageGeneration({
        session: input.session,
        round: rebuttalRound,
        runId: input.runId,
        provider: input.provider,
        callbacks: input.callbacks,
        assertActive: input.assertActive,
        agentKey: agent.key,
        agentName: agent.name,
        role: "agent",
        kind: "rebuttal",
        targetAgentKey: rebuttalTarget.targetAgentKey,
        rebuttalTarget: {
          targetAgentKey: rebuttalTarget.targetAgentKey,
          targetAgentName: rebuttalTarget.targetAgentName,
          weakestClaim: rebuttalTarget.weakestClaim,
          attackPoint: rebuttalTarget.attackPoint
        },
        system: formatAgentSystem(agent, input.session),
        prompt: formatRebuttalPrompt({
          session: input.session,
          agentName: agent.name,
          agentKey: agent.key,
          cycleNumber,
          debateState: contextState.debateState,
          recentMessages: contextState.recentMessages,
          retrievedMemories,
          opinionMessages: opinionRound.messages,
          targetAgentKey: rebuttalTarget.targetAgentKey,
          targetAgentName: rebuttalTarget.targetAgentName,
          weakestClaim: rebuttalTarget.weakestClaim,
          attackPoint: rebuttalTarget.attackPoint
        })
      });

      await persistMessage({
        round: rebuttalRound,
        state: contextState,
        usage,
        callbacks: input.callbacks,
        message: generated.message,
        usageDelta: generated.usage
      });
    }
  }

  await refreshDebateState({
    session: input.session,
    provider: input.provider,
    state: contextState,
    usage,
    callbacks: input.callbacks,
    assertActive: input.assertActive
  });

  await input.assertActive?.();

  const moderatorResponse = await input.provider.generateJson({
    provider: input.session.provider,
    model: input.session.model,
    variant: input.session.thinkingIntensity,
    system: [
      "You are the Ship Council moderator.",
      "Summarize the strongest agreements, disagreements, and execution risks from the iterative debate.",
      "Be concise and specific.",
      getThinkingIntensityInstruction(input.session),
      getLanguageInstruction(input.session)
    ].join("\n"),
    prompt: formatModeratorPrompt({
      session: input.session,
      debateState: contextState.debateState,
      recentMessages: contextState.recentMessages
    }),
    schema: moderatorSummarySchema
  });

  await input.assertActive?.();

  usage.totalPromptTokens += moderatorResponse.usage.promptTokens;
  usage.totalCompletionTokens += moderatorResponse.usage.completionTokens;
  await input.callbacks?.onUsage?.(moderatorResponse.usage);

  const summaryRound: OrchestratedRound = {
    ...createRound(
      input.session.id,
      input.runId,
      roundNumber,
      "summary",
      "Moderator Summary",
      moderatorResponse.data.summary
    ),
    messages: []
  };
  roundNumber += 1;
  rounds.push(summaryRound);
  await input.callbacks?.onRoundCreated?.(summaryRound);
  await input.callbacks?.onStreamEvent?.({
    type: "status",
    sessionId: input.session.id,
    runId: input.runId,
    status: "round-started",
    stage: summaryRound.stage,
    roundId: summaryRound.id,
    title: summaryRound.title,
    createdAt: summaryRound.createdAt
  });
  await input.callbacks?.onRoundSummary?.(summaryRound.id, moderatorResponse.data.summary);

  const summaryMessage = createMessage({
    sessionId: input.session.id,
    runId: input.runId,
    roundId: summaryRound.id,
    agentKey: "moderator",
    agentName: "Moderator",
    role: "moderator",
    kind: "summary",
    content: [
      "Key Points",
      ...moderatorResponse.data.keyPoints.map((item) => `- ${item}`),
      "",
      "Agreements",
      ...moderatorResponse.data.agreements.map((item) => `- ${item}`),
      "",
      "Disagreements",
      ...moderatorResponse.data.disagreements.map((item) => `- ${item}`),
      "",
      "Risks",
      ...moderatorResponse.data.risks.map((item) => `- ${item}`)
    ].join("\n")
  });

  await persistMessage({
    round: summaryRound,
    state: contextState,
    usage,
    callbacks: input.callbacks,
    message: summaryMessage,
    usageDelta: {
      promptTokens: 0,
      completionTokens: 0
    }
  });

  await refreshDebateState({
    session: input.session,
    provider: input.provider,
    state: contextState,
    usage,
    callbacks: input.callbacks,
    assertActive: input.assertActive
  });

  await input.assertActive?.();

  const finalResponse = await input.provider.generateJson({
    provider: input.session.provider,
    model: input.session.model,
    variant: input.session.thinkingIntensity,
    system: [
      "You are finalizing the Ship Council decision.",
      "Return a single actionable JSON payload.",
      "Use the iterative debate history and moderator summary to make a concrete call.",
      getThinkingIntensityInstruction(input.session),
      getLanguageInstruction(input.session)
    ].join("\n"),
    prompt: formatFinalPrompt({
      session: input.session,
      debateState: contextState.debateState,
      recentMessages: contextState.recentMessages,
      moderatorSummary: moderatorResponse.data
    }),
    schema: finalDecisionSchema,
    retries: 1
  });

  await input.assertActive?.();

  usage.totalPromptTokens += finalResponse.usage.promptTokens;
  usage.totalCompletionTokens += finalResponse.usage.completionTokens;
  await input.callbacks?.onUsage?.(finalResponse.usage);

  const finalDecision: DecisionSummary = {
    topRecommendation: finalResponse.data.topRecommendation,
    alternatives: [],
    risks: finalResponse.data.risks,
    assumptions: [],
    openQuestions: [],
    nextActions: [],
    finalSummary: finalResponse.data.finalSummary,
    todos: []
  };

  const finalRound: OrchestratedRound = {
    ...createRound(
      input.session.id,
      input.runId,
      roundNumber,
      "final",
      "Final Recommendation",
      finalDecision.finalSummary
    ),
    messages: []
  };
  rounds.push(finalRound);
  await input.callbacks?.onRoundCreated?.(finalRound);
  await input.callbacks?.onStreamEvent?.({
    type: "status",
    sessionId: input.session.id,
    runId: input.runId,
    status: "round-started",
    stage: finalRound.stage,
    roundId: finalRound.id,
    title: finalRound.title,
    createdAt: finalRound.createdAt
  });
  await input.callbacks?.onRoundSummary?.(finalRound.id, finalDecision.finalSummary);

  const finalMessage = createMessage({
    sessionId: input.session.id,
    runId: input.runId,
    roundId: finalRound.id,
    agentKey: "moderator",
    agentName: "Moderator",
    role: "moderator",
    kind: "final",
    content: [
      "Top Recommendation",
      finalDecision.topRecommendation,
      "",
      "Risks",
      ...(finalDecision.risks.length > 0 ? finalDecision.risks.map((item) => `- ${item}`) : ["- No major risks recorded."])
    ].join("\n")
  });

  await persistMessage({
    round: finalRound,
    state: contextState,
    usage,
    callbacks: input.callbacks,
    message: finalMessage,
    usageDelta: {
      promptTokens: 0,
      completionTokens: 0
    }
  });

  return {
    rounds,
    decision: finalDecision,
    usage
  };
}
