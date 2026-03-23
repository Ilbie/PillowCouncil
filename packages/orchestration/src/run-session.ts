import { getPresetDefinition } from "@ship-council/agents";
import type { CouncilProvider, ProviderUsage } from "@ship-council/providers";
import { z } from "zod";
import {
  createId,
  moderatorSummarySchema,
  nowIso,
  type LiveMessageRecord,
  type RunStreamEvent,
  type AgentDefinition,
  type DecisionSummary,
  type MessageRecord,
  type ModeratorSummary,
  type RoundRecord,
  type SessionLanguage,
  type SessionRecord,
  type UsageSummary
} from "@ship-council/shared";

type OrchestratedRound = RoundRecord & {
  messages: MessageRecord[];
};

type RunSessionResult = {
  rounds: OrchestratedRound[];
  decision: DecisionSummary;
  usage: UsageSummary;
};

type RunSessionCallbacks = {
  onRoundCreated?: (round: RoundRecord) => Promise<void> | void;
  onRoundSummary?: (roundId: string, summary: string | null) => Promise<void> | void;
  onMessageCreated?: (message: MessageRecord, usage: ProviderUsage) => Promise<void> | void;
  onUsage?: (usage: ProviderUsage) => Promise<void> | void;
  onStreamEvent?: (event: RunStreamEvent) => Promise<void> | void;
};

type RunActivityGuard = () => Promise<void> | void;

type ContextState = {
  compressedSummary: string | null;
  recentMessages: MessageRecord[];
};

const CONTEXT_CHAR_LIMIT = 12_000;
const CONTEXT_RECENT_MESSAGE_COUNT = 8;
const finalDecisionSchema = z.object({
  topRecommendation: z.string().min(1).max(1000),
  risks: z.array(z.string().min(1)).min(1).max(6),
  finalSummary: z.string().min(1).max(1600)
});

function createRound(
  sessionId: string,
  runId: string,
  roundNumber: number,
  stage: RoundRecord["stage"],
  title: string,
  summary: string | null = null
): RoundRecord {
  return {
    id: createId("round"),
    sessionId,
    runId,
    roundNumber,
    stage,
    title,
    summary,
    createdAt: nowIso()
  };
}

function createMessage(input: Omit<MessageRecord, "id" | "createdAt">): MessageRecord {
  return {
    ...input,
    id: createId("message"),
    createdAt: nowIso()
  };
}

function getLanguageInstruction(session: SessionRecord): string {
  const labels: Record<SessionLanguage, string> = {
    ko: "Korean",
    en: "English",
    ja: "Japanese"
  };

  return `Respond in ${labels[session.language] ?? "English"}.`;
}

function getThinkingIntensityLabel(session: SessionRecord): string {
  const normalized = session.thinkingIntensity.trim().toLowerCase();

  if (["low", "minimal", "fast", "light"].includes(normalized)) {
    return "low";
  }

  if (["deep", "high", "max", "hard"].includes(normalized)) {
    return "deep";
  }

  if (["medium", "balanced", "default", "normal"].includes(normalized)) {
    return "balanced";
  }

  switch (normalized) {
    case "low":
      return "low";
    case "deep":
      return "deep";
    default:
      return "balanced";
  }
}

function getThinkingIntensityInstruction(session: SessionRecord): string {
  switch (session.thinkingIntensity) {
    case "low":
      return "Prefer concise reasoning, fewer branches, and fast convergence.";
    case "deep":
      return "Reason carefully, pressure-test assumptions, and explore tradeoffs before concluding.";
    default:
      return "Balance speed with depth and test the most important tradeoffs.";
  }
}

function formatAgentSystem(agent: AgentDefinition, session: SessionRecord): string {
  return [
    agent.systemPrompt,
    `Role: ${agent.role}`,
    `Goal: ${agent.goal}`,
    `Bias: ${agent.bias}`,
    `Style: ${agent.style}`,
    `Planned debate cycles: ${session.debateIntensity}`,
    `Thinking intensity: ${getThinkingIntensityLabel(session)}`,
    "This discussion is iterative. Update your position after reading earlier rounds instead of repeating yourself.",
    getThinkingIntensityInstruction(session),
    "Be direct, concrete, and critical where needed."
  ].join("\n");
}

function renderMessages(messages: MessageRecord[]): string {
  if (messages.length === 0) {
    return "No prior discussion yet.";
  }

  return messages
    .map(
      (message) =>
        `- [${message.kind.toUpperCase()}] ${message.agentName}: ${message.content}`
    )
    .join("\n\n");
}

function renderContext(state: ContextState): string {
  return [
    state.compressedSummary ? `Compressed prior context:\n${state.compressedSummary}` : null,
    state.recentMessages.length > 0 ? `Recent discussion:\n${renderMessages(state.recentMessages)}` : null
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n\n")
    .trim();
}

async function maybeCompressContext(input: {
  session: SessionRecord;
  provider: CouncilProvider;
  state: ContextState;
  usage: UsageSummary;
  callbacks?: RunSessionCallbacks;
  assertActive?: RunActivityGuard;
}): Promise<void> {
  await input.assertActive?.();

  const context = renderContext(input.state);
  if (context.length <= CONTEXT_CHAR_LIMIT || input.state.recentMessages.length <= CONTEXT_RECENT_MESSAGE_COUNT) {
    return;
  }

  const messagesToCompress = input.state.recentMessages.slice(0, -CONTEXT_RECENT_MESSAGE_COUNT);
  if (messagesToCompress.length === 0) {
    return;
  }

    const response = await input.provider.generateText({
      provider: input.session.provider,
      model: input.session.model,
      variant: input.session.thinkingIntensity,
      system: [
      "You compress earlier debate history for later rounds.",
      "Keep the strongest claims, rebuttals, changes in position, unresolved conflicts, and operational risks.",
      "Return a short bullet summary only.",
      getThinkingIntensityInstruction(input.session),
      getLanguageInstruction(input.session)
    ].join("\n"),
    prompt: [
      `Topic: ${input.session.prompt}`,
      `Completed debate cycles so far: ${input.session.debateIntensity}`,
      "",
      input.state.compressedSummary ? `Existing compressed summary:\n${input.state.compressedSummary}` : null,
      "Messages to compress:",
      renderMessages(messagesToCompress)
    ]
      .filter((value): value is string => Boolean(value))
      .join("\n\n")
  });

  await input.assertActive?.();

  input.usage.totalPromptTokens += response.usage.promptTokens;
  input.usage.totalCompletionTokens += response.usage.completionTokens;
  await input.callbacks?.onUsage?.(response.usage);

  input.state.compressedSummary = [
    input.state.compressedSummary,
    response.text.trim()
  ]
    .filter(Boolean)
    .join("\n\n");
  input.state.recentMessages = input.state.recentMessages.slice(-CONTEXT_RECENT_MESSAGE_COUNT);
}

function formatOpinionPrompt(input: {
  session: SessionRecord;
  agentName: string;
  cycleNumber: number;
  context: string;
}): string {
  return [
    `Topic: ${input.session.prompt}`,
    `Current debate cycle: ${input.cycleNumber} of ${input.session.debateIntensity}`,
    `Thinking intensity: ${getThinkingIntensityLabel(input.session)}`,
    "",
    input.context ? `Prior debate context:\n${input.context}` : "No prior debate context yet.",
    "",
    `${input.agentName}, write your current position for this cycle.`,
    "You must refine your argument using the earlier discussion. Do not repeat yourself verbatim.",
    getThinkingIntensityInstruction(input.session),
    "Format:",
    "1. Current position in one sentence",
    "2. What changed since the prior discussion",
    "3. The strongest supporting reasons right now",
    "4. The biggest remaining risk",
    getLanguageInstruction(input.session)
  ].join("\n");
}

function formatRebuttalPrompt(input: {
  session: SessionRecord;
  agentName: string;
  cycleNumber: number;
  context: string;
  opinionMessages: MessageRecord[];
}): string {
  return [
    `Topic: ${input.session.prompt}`,
    `Current debate cycle: ${input.cycleNumber} of ${input.session.debateIntensity}`,
    `Thinking intensity: ${getThinkingIntensityLabel(input.session)}`,
    "",
    input.context ? `Prior debate context:\n${input.context}` : "No prior debate context yet.",
    "",
    "Current opinion round:",
    renderMessages(input.opinionMessages),
    "",
    `${input.agentName}, rebut the current positions.`,
    "Attack contradictions, weak assumptions, missing evidence, and execution risk.",
    getThinkingIntensityInstruction(input.session),
    "Format:",
    "1. The weakest claim you see",
    "2. Your rebuttal",
    "3. The most important unresolved conflict",
    "4. What should change before the next cycle",
    getLanguageInstruction(input.session)
  ].join("\n");
}

function formatModeratorPrompt(input: {
  session: SessionRecord;
  context: string;
}): string {
  return [
    `Topic: ${input.session.prompt}`,
    `Completed debate cycles: ${input.session.debateIntensity}`,
    `Thinking intensity: ${getThinkingIntensityLabel(input.session)}`,
    "",
    input.context ? `Compressed debate history:\n${input.context}` : "No debate history available.",
    "",
    "Return JSON matching this schema exactly:",
    '{"keyPoints":[],"agreements":[],"disagreements":[],"risks":[],"summary":""}',
    getLanguageInstruction(input.session)
  ].join("\n");
}

function formatFinalPrompt(input: {
  session: SessionRecord;
  context: string;
  moderatorSummary: ModeratorSummary;
}): string {
  return [
    `Topic: ${input.session.prompt}`,
    `Preset: ${input.session.customPreset?.name ?? input.session.presetId}`,
    `Language: ${input.session.language}`,
    `Completed debate cycles: ${input.session.debateIntensity}`,
    `Thinking intensity: ${getThinkingIntensityLabel(input.session)}`,
    "",
    input.context ? `Debate context:\n${input.context}` : "No debate context available.",
    "",
    "# Moderator summary",
    JSON.stringify(input.moderatorSummary, null, 2),
    "",
    "Return exactly one JSON object matching this shape:",
    '{"topRecommendation":"","risks":[],"finalSummary":""}',
    getThinkingIntensityInstruction(input.session),
    getLanguageInstruction(input.session)
  ].join("\n");
}

async function persistMessage(input: {
  round: OrchestratedRound;
  state: ContextState;
  usage: UsageSummary;
  callbacks?: RunSessionCallbacks;
  message: MessageRecord;
  usageDelta: ProviderUsage;
}): Promise<void> {
  input.round.messages.push(input.message);
  input.state.recentMessages.push(input.message);
  input.usage.totalPromptTokens += input.usageDelta.promptTokens;
  input.usage.totalCompletionTokens += input.usageDelta.completionTokens;
  await input.callbacks?.onMessageCreated?.(input.message, input.usageDelta);
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
    content: "",
    reasoning: "",
    createdAt: nowIso(),
    status: "streaming"
  };

  const response = await input.provider.generateText({
    provider: input.session.provider,
    model: input.session.model,
    variant: input.session.thinkingIntensity,
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
        delta,
        snapshot,
        createdAt: liveMessage.createdAt
      });
    }
  });

  await input.assertActive?.();

  const message: MessageRecord = {
    id: liveMessage.id,
    sessionId: input.session.id,
    runId: input.runId,
    roundId: input.round.id,
    agentKey: input.agentKey,
    agentName: input.agentName,
    role: input.role,
    kind: input.kind,
    content: response.text,
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
    content: response.text,
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
    compressedSummary: null,
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
    await maybeCompressContext({
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
          context: renderContext(contextState)
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

    await maybeCompressContext({
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
        system: formatAgentSystem(agent, input.session),
        prompt: formatRebuttalPrompt({
          session: input.session,
          agentName: agent.name,
          cycleNumber,
          context: renderContext(contextState),
          opinionMessages: opinionRound.messages
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

  await maybeCompressContext({
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
      context: renderContext(contextState)
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

  await maybeCompressContext({
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
      context: renderContext(contextState),
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
