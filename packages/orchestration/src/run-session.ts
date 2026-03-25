import { getPresetDefinition } from "@pillow-council/agents";
import type { PillowCouncilProvider, ProviderUsage } from "@pillow-council/providers";
import { z } from "zod";
import {
  agentDefinitionSchema,
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
  type PresetDefinition,
  type SessionRecord,
  type UsageSummary
} from "@pillow-council/shared";

import {
  formatAgentSystem,
  formatFinalPrompt,
  formatModeratorPrompt,
  formatPersonaCompilationPrompt,
  formatOpinionPrompt,
  formatResearchPlanPrompt,
  formatRebuttalPrompt,
  formatSpeakerRoutingPrompt,
  getLocalizedInterventionMessage,
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
  risks: z.array(z.string().min(1)).max(6),
  finalSummary: z.string().min(1).max(1600)
});
const rebuttalTargetSchema = z.object({
  targetAgentKey: z.string().min(1).max(80),
  weakestClaim: z.string().min(1).max(400),
  attackPoint: z.string().min(1).max(400)
});
type RebuttalTargetPlan = z.output<typeof rebuttalTargetSchema>;
const compiledPresetSchema = z.object({
  compiledPresetName: z.string().min(1).max(120),
  compiledPresetDescription: z.string().min(1).max(240),
  compiledAgents: z.array(agentDefinitionSchema).min(2).max(8)
});
const speakerRoutingSchema = z.object({
  shouldContinue: z.boolean(),
  nextSpeakerKey: z.string().min(1).max(80).nullable(),
  reason: z.string().min(1).max(240),
  suggestedTargetAgentKey: z.string().min(1).max(80).nullable()
});
const researchPlanSchema = z.object({
  shouldResearch: z.boolean(),
  focus: z.string().max(200),
  query: z.string().max(240),
  reason: z.string().max(240)
});
const ALIGNMENT_INTERVENTION_THRESHOLD = 6;

async function refreshDebateState(input: {
  session: SessionRecord;
  provider: PillowCouncilProvider;
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
        "CRITICAL INSTRUCTION: You MUST strictly align the whiteboard with the Original Topic.",
        "If the recent discussion has derailed into minor technical implementation details, error handling, or edge-case nitpicking that loses the big picture, ignore those tangents and do not record them as active conflicts unless they materially change the decision.",
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
      '{"agreedPoints":[],"activeConflicts":[],"pendingQuestions":[],"alignmentScore":10,"deviationWarning":null}'
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

  input.state.debateState = debateStateSchema.parse(response.data);
  await input.callbacks?.onDebateStateUpdated?.(input.state.debateState);
}

function buildFallbackRebuttalTarget(agentKey: string, opinionMessages: MessageRecord[]): RebuttalTargetPlan {
  const fallbackMessage = opinionMessages.find((message) => message.agentKey !== agentKey) ?? opinionMessages[0];

  return {
    targetAgentKey: fallbackMessage?.agentKey ?? agentKey,
    weakestClaim: fallbackMessage?.content.split("\n")[0]?.trim() || "The current claim needs stronger evidence.",
    attackPoint: "Ask for sharper evidence, clearer examples, or stronger decision relevance in that claim."
  };
}

async function selectRebuttalTarget(input: {
  session: SessionRecord;
  provider: PillowCouncilProvider;
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
      "You route one rebuttal turn for the PillowCouncil debate.",
      "Choose exactly one target agent whose current opinion most needs constructive pressure-testing.",
      "Prioritize claims that are abstract, weakly supported, or distracted by minor implementation details instead of the core topic.",
      "Return only JSON that matches the schema.",
      getThinkingIntensityInstruction(input.session),
      getLanguageInstruction(input.session)
    ].join("\n"),
    prompt: [
      "Select exactly one target agent for this constructive rebuttal.",
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

async function compileRuntimePreset(input: {
  session: SessionRecord;
  provider: PillowCouncilProvider;
  preset: PresetDefinition;
  usage: UsageSummary;
  callbacks?: RunSessionCallbacks;
  assertActive?: RunActivityGuard;
}): Promise<PresetDefinition> {
  const response = await input.provider.generateJson({
    provider: input.session.provider,
    model: input.session.model,
    variant: input.session.thinkingIntensity,
    system: [
      "You translate a debate panel into topic-appropriate expert personas before the session starts.",
      "Preserve the number of agents and keep each agent key identical to the original preset.",
      "Return only JSON that matches the schema.",
      getThinkingIntensityInstruction(input.session),
      getLanguageInstruction(input.session)
    ].join("\n"),
    prompt: formatPersonaCompilationPrompt({
      session: input.session,
      preset: input.preset
    }),
    schema: compiledPresetSchema,
    retries: 1
  });

  await input.assertActive?.();
  input.usage.totalPromptTokens += response.usage.promptTokens;
  input.usage.totalCompletionTokens += response.usage.completionTokens;
  await input.callbacks?.onUsage?.(response.usage);

  const compiledAgents = input.preset.agents.map((agent) => {
    const compiled = response.data.compiledAgents.find((candidate) => candidate.key === agent.key);
    return compiled ?? agent;
  });

  const compiledPreset: PresetDefinition = {
    id: input.preset.id,
    name: response.data.compiledPresetName,
    description: response.data.compiledPresetDescription,
    agents: compiledAgents
  };

  await input.callbacks?.onRuntimePresetCompiled?.(compiledPreset);
  return compiledPreset;
}

async function selectNextSpeaker(input: {
  session: SessionRecord;
  provider: PillowCouncilProvider;
  agents: AgentDefinition[];
  cycleNumber: number;
  stage: "opening" | "rebuttal";
  state: ContextState;
  usage: UsageSummary;
  callbacks?: RunSessionCallbacks;
  assertActive?: RunActivityGuard;
}): Promise<{ shouldContinue: boolean; agent: AgentDefinition | null; reason: string; suggestedTargetAgentKey: string | null }> {
  const lastSpeakerName = [...input.state.recentMessages].reverse().find((message) => message.role === "agent")?.agentName ?? null;
  const lastSpeakerKey = [...input.state.recentMessages].reverse().find((message) => message.role === "agent")?.agentKey ?? null;
  const eligibleAgents = input.stage === "rebuttal" && lastSpeakerKey
    ? input.agents.filter((agent) => agent.key !== lastSpeakerKey)
    : input.agents;
  const response = await input.provider.generateJson({
    provider: input.session.provider,
    model: input.session.model,
    variant: input.session.thinkingIntensity,
    system: [
      "You are the PillowCouncil moderator selecting the next speaker.",
      "Choose exactly one eligible speaker or stop the stage if another turn would not materially improve the debate.",
      "Return only JSON that matches the schema.",
      getThinkingIntensityInstruction(input.session),
      getLanguageInstruction(input.session)
    ].join("\n"),
    prompt: formatSpeakerRoutingPrompt({
      session: input.session,
      stage: input.stage,
      cycleNumber: input.cycleNumber,
      debateState: input.state.debateState,
      recentMessages: input.state.recentMessages,
      availableAgents: eligibleAgents.length > 0 ? eligibleAgents : input.agents,
      lastSpeakerName
    }),
    schema: speakerRoutingSchema,
    retries: 1
  });

  await input.assertActive?.();
  input.usage.totalPromptTokens += response.usage.promptTokens;
  input.usage.totalCompletionTokens += response.usage.completionTokens;
  await input.callbacks?.onUsage?.(response.usage);

  if (!response.data.shouldContinue || !response.data.nextSpeakerKey) {
    return {
      shouldContinue: false,
      agent: null,
      reason: response.data.reason,
      suggestedTargetAgentKey: null
    };
  }

  const selectedAgent = (eligibleAgents.length > 0 ? eligibleAgents : input.agents).find((agent) => agent.key === response.data.nextSpeakerKey) ?? null;
  if (!selectedAgent) {
    return {
      shouldContinue: false,
      agent: null,
      reason: response.data.reason,
      suggestedTargetAgentKey: null
    };
  }

  return {
    shouldContinue: true,
    agent: selectedAgent,
    reason: response.data.reason,
    suggestedTargetAgentKey: response.data.suggestedTargetAgentKey
  };
}

async function planSpeakerResearch(input: {
  session: SessionRecord;
  provider: PillowCouncilProvider;
  agent: AgentDefinition;
  stage: "opinion" | "rebuttal";
  cycleNumber: number;
  state: ContextState;
  retrievedMemories: MemorySearchResult[];
  usage: UsageSummary;
  callbacks?: RunSessionCallbacks;
  assertActive?: RunActivityGuard;
}): Promise<z.output<typeof researchPlanSchema>> {
  const response = await input.provider.generateJson({
    provider: input.session.provider,
    model: input.session.model,
    variant: input.session.thinkingIntensity,
    enableWebSearch: input.session.enableWebSearch,
    system: [
      "You decide whether a debate turn needs a short research phase before speaking.",
      "Research only if fresh evidence or concrete examples would materially improve the answer.",
      "Keep research tightly bounded to one query.",
      "Return only JSON that matches the schema.",
      getThinkingIntensityInstruction(input.session),
      getLanguageInstruction(input.session)
    ].join("\n"),
    prompt: formatResearchPlanPrompt({
      session: input.session,
      agent: input.agent,
      stage: input.stage,
      cycleNumber: input.cycleNumber,
      debateState: input.state.debateState,
      recentMessages: input.state.recentMessages,
      retrievedMemories: input.retrievedMemories
    }),
    schema: researchPlanSchema,
    retries: 1
  });

  await input.assertActive?.();
  input.usage.totalPromptTokens += response.usage.promptTokens;
  input.usage.totalCompletionTokens += response.usage.completionTokens;
  await input.callbacks?.onUsage?.(response.usage);

  return response.data;
}

async function runSpeakerResearch(input: {
  session: SessionRecord;
  provider: PillowCouncilProvider;
  agent: AgentDefinition;
  stage: "opinion" | "rebuttal";
  plan: z.output<typeof researchPlanSchema>;
  usage: UsageSummary;
  callbacks?: RunSessionCallbacks;
  assertActive?: RunActivityGuard;
}): Promise<string | null> {
  if (!input.plan.shouldResearch || !input.plan.query.trim()) {
    return null;
  }

  const response = await input.provider.generateText({
    provider: input.session.provider,
    model: input.session.model,
    variant: input.session.thinkingIntensity,
    enableWebSearch: input.session.enableWebSearch,
    system: [
      "Run a short research phase before the agent speaks.",
      "Gather only the minimum evidence needed for the next debate turn.",
      "Return concise research notes, not the final debate answer.",
      getThinkingIntensityInstruction(input.session),
      getLanguageInstruction(input.session)
    ].join("\n"),
    prompt: [
      `Topic: ${input.session.prompt}`,
      `Agent: ${input.agent.name}`,
      `Stage: ${input.stage}`,
      `Research focus: ${input.plan.focus || "Material evidence for the next turn"}`,
      `Search query: ${input.plan.query}`,
      `Why research: ${input.plan.reason || "Fresh evidence would materially improve the answer."}`
    ].join("\n")
  });

  await input.assertActive?.();
  input.usage.totalPromptTokens += response.usage.promptTokens;
  input.usage.totalCompletionTokens += response.usage.completionTokens;
  await input.callbacks?.onUsage?.(response.usage);

  return response.text.trim() || null;
}

async function maybeInjectSystemIntervention(input: {
  session: SessionRecord;
  round: OrchestratedRound;
  runId: string;
  state: ContextState;
  usage: UsageSummary;
  callbacks?: RunSessionCallbacks;
}): Promise<void> {
  if (input.state.debateState.alignmentScore > ALIGNMENT_INTERVENTION_THRESHOLD || !input.state.debateState.deviationWarning) {
    return;
  }

  const latestMessage = input.round.messages[input.round.messages.length - 1] ?? null;
  if (latestMessage?.role === "system" && latestMessage.kind === "intervention") {
    return;
  }

  const interventionMessage = createMessage({
    sessionId: input.session.id,
    runId: input.runId,
    roundId: input.round.id,
    agentKey: "system",
    agentName: "System",
    role: "system",
    kind: "intervention",
    content: getLocalizedInterventionMessage({
      language: input.session.language,
      warning: input.state.debateState.deviationWarning,
      topic: input.session.prompt
    })
  });

  await persistMessage({
    round: input.round,
    state: input.state,
    usage: input.usage,
    callbacks: input.callbacks,
    message: interventionMessage,
    usageDelta: {
      promptTokens: 0,
      completionTokens: 0,
      mcpCalls: 0,
      skillUses: 0,
      webSearches: 0
    }
  });
}

async function streamMessageGeneration(input: {
  session: SessionRecord;
  round: OrchestratedRound;
  runId: string;
  provider: PillowCouncilProvider;
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

export async function runPillowCouncilSession(input: {
  session: SessionRecord;
  runId: string;
  provider: PillowCouncilProvider;
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
  const basePreset = input.session.customPreset ?? getPresetDefinition(input.session.presetId);
  if (!basePreset) {
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

  const runtimePreset = await compileRuntimePreset({
    session: input.session,
    provider: input.provider,
    preset: basePreset,
    usage,
    callbacks: input.callbacks,
    assertActive: input.assertActive
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

    const openingRoute = await selectNextSpeaker({
      session: input.session,
      provider: input.provider,
      agents: runtimePreset.agents,
      cycleNumber,
      stage: "opening",
      state: contextState,
      usage,
      callbacks: input.callbacks,
      assertActive: input.assertActive
    });

    const opinionRound: OrchestratedRound | null = openingRoute.shouldContinue && openingRoute.agent
      ? {
          ...createRound(input.session.id, input.runId, roundNumber, "opening", `Opinion ${cycleNumber}`),
          messages: []
        }
      : null;

    if (openingRoute.shouldContinue && openingRoute.agent) {
      roundNumber += 1;
      rounds.push(opinionRound!);
      await input.callbacks?.onRoundCreated?.(opinionRound!);
      await input.callbacks?.onStreamEvent?.({
        type: "status",
        sessionId: input.session.id,
        runId: input.runId,
        status: "round-started",
        stage: opinionRound!.stage,
        roundId: opinionRound!.id,
        title: opinionRound!.title,
        createdAt: opinionRound!.createdAt
      });
      const agent = openingRoute.agent;
      const retrievedMemories = await loadRetrievedMemories({
        session: input.session,
        runId: input.runId,
        agentKey: agent.key,
        agentName: agent.name,
        kind: "opinion",
        state: contextState,
        retrieveMemories: input.retrieveMemories
      });
      const researchPlan = await planSpeakerResearch({
        session: input.session,
        provider: input.provider,
        agent,
        stage: "opinion",
        cycleNumber,
        state: contextState,
        retrievedMemories,
        usage,
        callbacks: input.callbacks,
        assertActive: input.assertActive
      });
      const researchNotes = await runSpeakerResearch({
        session: input.session,
        provider: input.provider,
        agent,
        stage: "opinion",
        plan: researchPlan,
        usage,
        callbacks: input.callbacks,
        assertActive: input.assertActive
      });
      const generated = await streamMessageGeneration({
        session: input.session,
        round: opinionRound!,
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
          retrievedMemories,
          researchNotes
        })
      });

      await persistMessage({
        round: opinionRound!,
        state: contextState,
        usage,
        callbacks: input.callbacks,
        message: generated.message,
        usageDelta: generated.usage
      });
      opinionRound!.summary = openingRoute.reason;
      await input.callbacks?.onRoundSummary?.(opinionRound!.id, openingRoute.reason);
    }

    await refreshDebateState({
      session: input.session,
      provider: input.provider,
      state: contextState,
      usage,
      callbacks: input.callbacks,
      assertActive: input.assertActive
    });
    if (opinionRound) {
      await maybeInjectSystemIntervention({
        session: input.session,
        round: opinionRound,
        runId: input.runId,
        state: contextState,
        usage,
        callbacks: input.callbacks
      });
    }

    await input.assertActive?.();

    const rebuttalRoute = await selectNextSpeaker({
      session: input.session,
      provider: input.provider,
      agents: runtimePreset.agents,
      cycleNumber,
      stage: "rebuttal",
      state: contextState,
      usage,
      callbacks: input.callbacks,
      assertActive: input.assertActive
    });

    const rebuttalRound: OrchestratedRound | null = rebuttalRoute.shouldContinue && rebuttalRoute.agent && opinionRound && opinionRound.messages.length > 0
      ? {
          ...createRound(input.session.id, input.runId, roundNumber, "rebuttal", `Rebuttal ${cycleNumber}`),
          messages: []
        }
      : null;

    if (rebuttalRoute.shouldContinue && rebuttalRoute.agent && opinionRound && opinionRound.messages.length > 0 && rebuttalRound) {
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
      const agent = rebuttalRoute.agent;
      const retrievedMemories = await loadRetrievedMemories({
        session: input.session,
        runId: input.runId,
        agentKey: agent.key,
        agentName: agent.name,
        kind: "rebuttal",
        state: contextState,
        retrieveMemories: input.retrieveMemories
      });
      const researchPlan = await planSpeakerResearch({
        session: input.session,
        provider: input.provider,
        agent,
        stage: "rebuttal",
        cycleNumber,
        state: contextState,
        retrievedMemories,
        usage,
        callbacks: input.callbacks,
        assertActive: input.assertActive
      });
      const researchNotes = await runSpeakerResearch({
        session: input.session,
        provider: input.provider,
        agent,
        stage: "rebuttal",
        plan: researchPlan,
        usage,
        callbacks: input.callbacks,
        assertActive: input.assertActive
      });
      let rebuttalTarget = await selectRebuttalTarget({
        session: input.session,
        provider: input.provider,
        agent,
        cycleNumber,
        opinionMessages: opinionRound.messages,
        usage,
        callbacks: input.callbacks,
        assertActive: input.assertActive
      });
      if (rebuttalRoute.suggestedTargetAgentKey) {
        const suggestedTarget = opinionRound.messages.find((message) => message.agentKey === rebuttalRoute.suggestedTargetAgentKey);
        if (suggestedTarget) {
          rebuttalTarget = {
            targetAgentKey: suggestedTarget.agentKey,
            targetAgentName: suggestedTarget.agentName,
            weakestClaim: suggestedTarget.content.split("\n")[0]?.trim() || suggestedTarget.content.trim(),
            attackPoint: rebuttalRoute.reason
          };
        }
      }
      if (rebuttalTarget.targetAgentKey === agent.key) {
        const alternateTarget = opinionRound.messages.find((message) => message.agentKey !== agent.key);
        if (!alternateTarget) {
          continue;
        }
        rebuttalTarget = {
          targetAgentKey: alternateTarget.agentKey,
          targetAgentName: alternateTarget.agentName,
          weakestClaim: alternateTarget.content.split("\n")[0]?.trim() || alternateTarget.content.trim(),
          attackPoint: rebuttalTarget.attackPoint
        };
      }
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
          attackPoint: rebuttalTarget.attackPoint,
          researchNotes
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
      rebuttalRound.summary = rebuttalRoute.reason;
      await input.callbacks?.onRoundSummary?.(rebuttalRound.id, rebuttalRoute.reason);
    }

    await refreshDebateState({
      session: input.session,
      provider: input.provider,
      state: contextState,
      usage,
      callbacks: input.callbacks,
      assertActive: input.assertActive
    });
    if (rebuttalRound) {
      await maybeInjectSystemIntervention({
        session: input.session,
        round: rebuttalRound,
        runId: input.runId,
        state: contextState,
        usage,
        callbacks: input.callbacks
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
      "You are the PillowCouncil moderator.",
      "Summarize the strongest agreements, disagreements, and decision-relevant risks from the iterative debate.",
      "Keep the summary centered on the original topic and ignore minor technical tangents unless they materially change the decision.",
      "If no material risks remain, return an empty risks array.",
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
      ...(moderatorResponse.data.risks.length > 0 ? moderatorResponse.data.risks.map((item) => `- ${item}`) : ["- No material risks recorded."])
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
      completionTokens: 0,
      mcpCalls: 0,
      skillUses: 0,
      webSearches: 0
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
    enableWebSearch: input.session.enableWebSearch,
    system: [
      "You are finalizing the PillowCouncil decision.",
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
      completionTokens: 0,
      mcpCalls: 0,
      skillUses: 0,
      webSearches: 0
    }
  });

  return {
    rounds,
    decision: finalDecision,
    usage
  };
}
