import type { AgentDefinition, DebateState, MemorySearchResult, MessageRecord, ModeratorSummary, PresetDefinition, SessionLanguage, SessionRecord } from "@pillow-council/shared";
import { parseRebuttalTargetHeader } from "@pillow-council/shared";

export const STRUCTURED_REASON_MAX_CHARS = 600;

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
    "IMPORTANT ROLE ADAPTATION: Adapt your role to the nature of the Topic.",
    "If the Topic is about business strategy, macro-economics, or high-level ideation, DO NOT use software engineering jargon, architecture specs, or code-level error handling logic.",
    "Express your role's core philosophy using general business or domain-appropriate language.",
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
    state.pendingQuestions.length === 0 &&
    state.alignmentScore >= 10 &&
    !state.deviationWarning
  ) {
    return "No structured working memory yet.";
  }

  return [
    `Alignment score: ${state.alignmentScore}/10`,
    `Deviation warning: ${state.deviationWarning ?? "None"}`,
    "",
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
  researchNotes?: string | null;
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
    input.researchNotes ? `Research notes:\n${input.researchNotes}` : "No additional research notes.",
    "",
    input.recentMessages.length > 0 ? `Recent discussion:\n${renderMessages(input.recentMessages)}` : "No recent discussion yet.",
    "",
    `${input.agentName}, write your current position for this cycle.`,
    "You must refine your argument using the earlier discussion. Do not repeat yourself verbatim.",
    "Stay focused on the core topic and decision, not minor implementation details unless they materially change the answer.",
    getThinkingIntensityInstruction(input.session),
    "Format:",
    "1. Current position in one sentence",
    "2. What changed since the prior discussion",
    "3. The strongest supporting reasons right now",
    "4. The most important open question or meaningful risk",
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
  researchNotes?: string | null;
}): string {
  return [
    `Topic: ${input.session.prompt}`,
    `Current debate cycle: ${input.cycleNumber} of ${input.session.debateIntensity}`,
    `Thinking intensity: ${getThinkingIntensityLabel(input.session)}`,
    `Rebutting agent key: ${input.agentKey}`,
    `Target agent key: ${input.targetAgentKey}`,
    `Target agent name: ${input.targetAgentName}`,
    `Target claim: ${input.weakestClaim}`,
    `Critique focus: ${input.attackPoint}`,
    "",
    "Current debate whiteboard:",
    renderDebateState(input.debateState),
    "",
    "Retrieved prior details:",
    renderRetrievedMemories(input.retrievedMemories),
    "",
    input.researchNotes ? `Research notes:\n${input.researchNotes}` : "No additional research notes.",
    "",
    input.recentMessages.length > 0 ? `Recent discussion:\n${renderMessages(input.recentMessages)}` : "No recent discussion yet.",
    "",
    "Current opinion round:",
    renderMessages(input.opinionMessages),
    "",
    `${input.agentName}, rebut exactly one target agent from the current opinion round.`,
    "Select exactly one disagreement to challenge constructively.",
    "Do not spread your rebuttal across multiple agents.",
    "Provide a constructive critique of the target's claim.",
    "If the target's claim is too abstract, demand concrete examples.",
    "If the target is bogged down in minor implementation details like coding or error handling, redirect the focus back to the core Topic and business/user value.",
    "Identify logical flaws or execution risks, but do not attack merely for the sake of attacking.",
    getThinkingIntensityInstruction(input.session),
    "Format:",
    "1. Start by naming the target agent and the claim you are challenging",
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
    "Keep the summary centered on the Original Topic and ignore minor technical tangents unless they materially change the decision.",
    "If no material risks remain, return an empty risks array.",
    "Return JSON matching this schema exactly:",
    '{"keyPoints":[],"agreements":[],"disagreements":[],"risks":[],"summary":""}',
    getLanguageInstruction(input.session)
  ].join("\n");
}

export function formatPersonaCompilationPrompt(input: {
  session: SessionRecord;
  preset: PresetDefinition;
}): string {
  return [
    `Topic: ${input.session.prompt}`,
    `Language: ${input.session.language}`,
    `Thinking intensity: ${getThinkingIntensityLabel(input.session)}`,
    "",
    "Original preset:",
    JSON.stringify(input.preset, null, 2),
    "",
    "You are a persona compiler.",
    "Preserve each agent key, but adapt the role, goal, bias, style, and system prompt to the actual topic domain.",
    "When the topic is non-technical, translate technical personas into domain-appropriate expert roles instead of keeping software jargon.",
    "Keep each field concise, operational, and debate-ready.",
    "Return JSON matching this shape exactly:",
    '{"compiledPresetName":"","compiledPresetDescription":"","compiledAgents":[{"key":"","name":"","role":"","goal":"","bias":"","style":"","systemPrompt":""}]}',
    getLanguageInstruction(input.session)
  ].join("\n");
}

export function formatSpeakerRoutingPrompt(input: {
  session: SessionRecord;
  stage: "opening" | "rebuttal";
  cycleNumber: number;
  debateState: DebateState;
  recentMessages: MessageRecord[];
  availableAgents: AgentDefinition[];
  lastSpeakerName?: string | null;
}): string {
  return [
    `Topic: ${input.session.prompt}`,
    `Stage: ${input.stage}`,
    `Current debate cycle: ${input.cycleNumber} of ${input.session.debateIntensity}`,
    `Last speaker: ${input.lastSpeakerName ?? "None"}`,
    "",
    "Current debate whiteboard:",
    renderDebateState(input.debateState),
    "",
    input.recentMessages.length > 0 ? `Recent discussion:\n${renderMessages(input.recentMessages)}` : "No recent discussion yet.",
    "",
    "Eligible speakers:",
    ...input.availableAgents.map((agent) => `- ${agent.key} | ${agent.name} | ${agent.role}`),
    "",
    "You are the moderator selecting exactly one next speaker.",
    "Choose the speaker who can most improve the debate by adding new information, answering a direct challenge, or refocusing the topic.",
    "Avoid repetitive ping-pong and avoid picking the last speaker again unless the rebuttal stage clearly requires it.",
    "If no speaker would materially improve the debate, stop this stage.",
    `Keep the reason concise and under ${STRUCTURED_REASON_MAX_CHARS} characters.`,
    "Return JSON matching this shape exactly:",
    '{"shouldContinue":true,"nextSpeakerKey":"","reason":"","suggestedTargetAgentKey":null}',
    getLanguageInstruction(input.session)
  ].join("\n");
}

export function formatResearchPlanPrompt(input: {
  session: SessionRecord;
  agent: AgentDefinition;
  stage: "opinion" | "rebuttal";
  cycleNumber: number;
  debateState: DebateState;
  recentMessages: MessageRecord[];
  retrievedMemories: MemorySearchResult[];
}): string {
  return [
    `Topic: ${input.session.prompt}`,
    `Stage: ${input.stage}`,
    `Current debate cycle: ${input.cycleNumber} of ${input.session.debateIntensity}`,
    `Agent: ${input.agent.name}`,
    `Web search enabled: ${input.session.enableWebSearch ? "yes" : "no"}`,
    "",
    "Current debate whiteboard:",
    renderDebateState(input.debateState),
    "",
    "Retrieved prior details:",
    renderRetrievedMemories(input.retrievedMemories),
    "",
    input.recentMessages.length > 0 ? `Recent discussion:\n${renderMessages(input.recentMessages)}` : "No recent discussion yet.",
    "",
    "Decide whether this turn needs research before speaking.",
    "Choose research if fresh evidence, policy facts, market data, competitor examples, or external references would materially improve the answer.",
    "When web search is enabled, prefer one bounded search over guessing whenever the turn depends on current facts, market reality, or external examples.",
    "If web search is enabled and the turn could benefit from current external facts, default to one bounded search instead of skipping research.",
    "Keep research tightly bounded.",
    `Keep the reason concise and under ${STRUCTURED_REASON_MAX_CHARS} characters.`,
    "Return JSON matching this shape exactly:",
    '{"shouldResearch":false,"focus":"","query":"","reason":""}',
    getLanguageInstruction(input.session)
  ].join("\n");
}

export function getLocalizedInterventionMessage(input: {
  language: SessionLanguage;
  warning: string;
  topic: string;
}): string {
  switch (input.language) {
    case "ko":
      return `[시스템] 경고: ${input.warning} 즉시 원래 주제인 "${input.topic}"로 돌아오세요.`;
    case "ja":
      return `[システム] 警告: ${input.warning} 直ちに元のトピック「${input.topic}」に戻ってください。`;
    default:
      return `[System] Warning: ${input.warning} Return immediately to the original topic, "${input.topic}".`;
  }
}

export function formatFinalPrompt(input: {
  session: SessionRecord;
  debateState: DebateState;
  recentMessages: MessageRecord[];
  moderatorSummary: ModeratorSummary;
}): string {
  const finalLabels: Record<SessionLanguage, { moderatorSummary: string; recentDiscussion: string; whiteboard: string; noContext: string }> = {
    ko: {
      moderatorSummary: "# 모더레이터 요약",
      recentDiscussion: "최근 토론",
      whiteboard: "현재 토론 화이트보드:",
      noContext: "사용 가능한 토론 컨텍스트가 없습니다."
    },
    en: {
      moderatorSummary: "# Moderator summary",
      recentDiscussion: "Recent discussion",
      whiteboard: "Current debate whiteboard:",
      noContext: "No debate context available."
    },
    ja: {
      moderatorSummary: "# モデレーター要約",
      recentDiscussion: "最近の討論",
      whiteboard: "現在の討論ホワイトボード:",
      noContext: "利用可能な討論コンテキストはありません。"
    }
  };
  const labels = finalLabels[input.session.language] ?? finalLabels.en;

  return [
    `Topic: ${input.session.prompt}`,
    `Preset: ${input.session.customPreset?.name ?? input.session.presetId}`,
    `Language: ${input.session.language}`,
    `Completed debate cycles: ${input.session.debateIntensity}`,
    `Thinking intensity: ${getThinkingIntensityLabel(input.session)}`,
    "",
    labels.whiteboard,
    renderDebateState(input.debateState),
    "",
    input.recentMessages.length > 0 ? `${labels.recentDiscussion}:\n${renderMessages(input.recentMessages)}` : labels.noContext,
    "",
    labels.moderatorSummary,
    JSON.stringify(input.moderatorSummary, null, 2),
    "",
    "Synthesize the debate into a final decision.",
    "Ensure the final output directly answers the Original Topic.",
    "Avoid summarizing minor technical tangents.",
    "If no material risks remain, return an empty risks array.",
    "Return exactly one JSON object matching this shape:",
    '{"topRecommendation":"","risks":[],"finalSummary":""}',
    getThinkingIntensityInstruction(input.session),
    getLanguageInstruction(input.session)
  ].join("\n");
}
