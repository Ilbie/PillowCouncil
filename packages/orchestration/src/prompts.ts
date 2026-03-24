import type { AgentDefinition, DebateState, MemorySearchResult, MessageRecord, ModeratorSummary, SessionLanguage, SessionRecord } from "@ship-council/shared";
import { parseRebuttalTargetHeader } from "@ship-council/shared";

export function getLanguageInstruction(session: SessionRecord): string {
  const labels: Record<SessionLanguage, string> = {
    ko: "Korean",
    en: "English",
    ja: "Japanese"
  };

  return `Respond in ${labels[session.language] ?? "English"}.`;
}

export function getThinkingIntensityLabel(session: SessionRecord): string {
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

export function getThinkingIntensityInstruction(session: SessionRecord): string {
  switch (session.thinkingIntensity) {
    case "low":
      return "Prefer concise reasoning, fewer branches, and fast convergence.";
    case "deep":
      return "Reason carefully, pressure-test assumptions, and explore tradeoffs before concluding.";
    default:
      return "Balance speed with depth and test the most important tradeoffs.";
  }
}

export function formatAgentSystem(agent: AgentDefinition, session: SessionRecord): string {
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

export function renderMessages(messages: MessageRecord[]): string {
  if (messages.length === 0) {
    return "No prior discussion yet.";
  }

  return messages
    .map((message) => {
      const parsed = parseRebuttalTargetHeader(message.content);
      const targetLabel =
        message.kind === "rebuttal" && parsed.metadata
          ? ` against ${parsed.metadata.targetAgentName}`
          : "";

      return `- [${message.kind.toUpperCase()}${targetLabel}] ${message.agentName}: ${parsed.body}`;
    })
    .join("\n\n");
}

export function renderDebateState(state: DebateState): string {
  if (
    state.agreedPoints.length === 0 &&
    state.activeConflicts.length === 0 &&
    state.pendingQuestions.length === 0
  ) {
    return "No structured working memory yet.";
  }

  return [
    "Agreed points:",
    ...(state.agreedPoints.length > 0 ? state.agreedPoints.map((item) => `- ${item}`) : ["- None yet."]),
    "",
    "Active conflicts:",
    ...(state.activeConflicts.length > 0 ? state.activeConflicts.map((item) => `- ${item}`) : ["- None yet."]),
    "",
    "Pending questions:",
    ...(state.pendingQuestions.length > 0 ? state.pendingQuestions.map((item) => `- ${item}`) : ["- None yet."])
  ].join("\n");
}

export function renderRetrievedMemories(memories: MemorySearchResult[]): string {
  if (memories.length === 0) {
    return "No additional prior details retrieved.";
  }

  return memories
    .map((memory) => {
      const roundLabel = memory.roundNumber ? `Round ${memory.roundNumber}` : "Round ?";
      const stageLabel = memory.stage ? memory.stage.toUpperCase() : "UNKNOWN";
      return `- ${roundLabel} [${stageLabel}] ${memory.agentName}: ${memory.content}`;
    })
    .join("\n");
}

export function buildMemoryQuery(session: SessionRecord, recentMessages: MessageRecord[]): string {
  const stopWords = new Set([
    "about",
    "after",
    "before",
    "could",
    "should",
    "their",
    "there",
    "would",
    "these",
    "those",
    "because",
    "while",
    "which",
    "what",
    "when",
    "where",
    "have",
    "must",
    "this",
    "that",
    "with",
    "from",
    "into",
    "your"
  ]);

  const tokens = `${session.prompt} ${recentMessages.map((message) => message.content).join(" ")}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !stopWords.has(token));

  return [...new Set(tokens)].slice(0, 8).join(" ");
}

export function formatOpinionPrompt(input: {
  session: SessionRecord;
  agentName: string;
  cycleNumber: number;
  debateState: DebateState;
  recentMessages: MessageRecord[];
  retrievedMemories: MemorySearchResult[];
}): string {
  return [
    `Topic: ${input.session.prompt}`,
    `Current debate cycle: ${input.cycleNumber} of ${input.session.debateIntensity}`,
    `Thinking intensity: ${getThinkingIntensityLabel(input.session)}`,
    "",
    "Current debate whiteboard:",
    renderDebateState(input.debateState),
    "",
    "Retrieved prior details:",
    renderRetrievedMemories(input.retrievedMemories),
    "",
    input.recentMessages.length > 0 ? `Recent discussion:\n${renderMessages(input.recentMessages)}` : "No recent discussion yet.",
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

export function formatRebuttalPrompt(input: {
  session: SessionRecord;
  agentName: string;
  agentKey: string;
  cycleNumber: number;
  debateState: DebateState;
  recentMessages: MessageRecord[];
  retrievedMemories: MemorySearchResult[];
  opinionMessages: MessageRecord[];
  targetAgentKey: string;
  targetAgentName: string;
  weakestClaim: string;
  attackPoint: string;
}): string {
  return [
    `Topic: ${input.session.prompt}`,
    `Current debate cycle: ${input.cycleNumber} of ${input.session.debateIntensity}`,
    `Thinking intensity: ${getThinkingIntensityLabel(input.session)}`,
    `Rebutting agent key: ${input.agentKey}`,
    `Target agent key: ${input.targetAgentKey}`,
    `Target agent name: ${input.targetAgentName}`,
    `Target claim: ${input.weakestClaim}`,
    `Attack point: ${input.attackPoint}`,
    "",
    "Current debate whiteboard:",
    renderDebateState(input.debateState),
    "",
    "Retrieved prior details:",
    renderRetrievedMemories(input.retrievedMemories),
    "",
    input.recentMessages.length > 0 ? `Recent discussion:\n${renderMessages(input.recentMessages)}` : "No recent discussion yet.",
    "",
    "Current opinion round:",
    renderMessages(input.opinionMessages),
    "",
    `${input.agentName}, rebut exactly one target agent from the current opinion round.`,
    "Select exactly one disagreement to attack.",
    "Do not spread your rebuttal across multiple agents.",
    "Attack contradictions, weak assumptions, missing evidence, and execution risk.",
    getThinkingIntensityInstruction(input.session),
    "Format:",
    "1. Start by naming the target agent and the claim you are attacking",
    "2. Deliver your rebuttal",
    "3. Explain the unresolved conflict that still matters most",
    "4. State what the target agent should change before the next cycle",
    getLanguageInstruction(input.session)
  ].join("\n");
}

export function formatModeratorPrompt(input: {
  session: SessionRecord;
  debateState: DebateState;
  recentMessages: MessageRecord[];
}): string {
  return [
    `Topic: ${input.session.prompt}`,
    `Completed debate cycles: ${input.session.debateIntensity}`,
    `Thinking intensity: ${getThinkingIntensityLabel(input.session)}`,
    "",
    "Current debate whiteboard:",
    renderDebateState(input.debateState),
    "",
    input.recentMessages.length > 0 ? `Recent discussion:\n${renderMessages(input.recentMessages)}` : "No debate history available.",
    "",
    "Return JSON matching this schema exactly:",
    '{"keyPoints":[],"agreements":[],"disagreements":[],"risks":[],"summary":""}',
    getLanguageInstruction(input.session)
  ].join("\n");
}

export function formatFinalPrompt(input: {
  session: SessionRecord;
  debateState: DebateState;
  recentMessages: MessageRecord[];
  moderatorSummary: ModeratorSummary;
}): string {
  return [
    `Topic: ${input.session.prompt}`,
    `Preset: ${input.session.customPreset?.name ?? input.session.presetId}`,
    `Language: ${input.session.language}`,
    `Completed debate cycles: ${input.session.debateIntensity}`,
    `Thinking intensity: ${getThinkingIntensityLabel(input.session)}`,
    "",
    "Current debate whiteboard:",
    renderDebateState(input.debateState),
    "",
    input.recentMessages.length > 0 ? `Recent discussion:\n${renderMessages(input.recentMessages)}` : "No debate context available.",
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
