import type { LiveMessageRecord, MessageRecord, PanelPreset, RunStage, SessionDetailResponse } from "@ship-council/shared";

export type VisualizationStageStatus = "pending" | "active" | "completed";
export type VisualizationAgentStatus = "queued" | "active" | "done";

export type VisualizationStage = {
  key: RunStage;
  expectedRounds: number;
  completedRounds: number;
  pendingRounds: number;
  status: VisualizationStageStatus;
  progressRatio: number;
  currentRoundNumber: number | null;
  currentSpeakerCount: number;
  totalSpeakerCount: number;
};

export type VisualizationAgent = {
  agentKey: string;
  agentName: string;
  role: string;
  contributionCount: number;
  status: VisualizationAgentStatus;
};

export type VisualizationFeedEntry =
  | {
      type: "system";
      stage: RunStage | null;
    }
  | {
      type: "message";
      id: string;
      stage: RunStage;
      agentKey: string;
      agentName: string;
      kind: string;
      label: string;
      createdAt: string;
      isStreaming: boolean;
    };

export type VisualizationTimelineMessage = {
  id: string;
  roundId: string | null;
  agentKey: string;
  agentName: string;
  role: MessageRecord["role"];
  kind: MessageRecord["kind"];
  content: string;
  reasoning: string;
  createdAt: string;
  isStreaming: boolean;
};

export type VisualizationTimelineRound = {
  id: string;
  roundNumber: number;
  stage: RunStage;
  title: string;
  summary: string | null;
  messages: VisualizationTimelineMessage[];
};

export type DebateVisualization = {
  summary: {
    expectedRounds: number;
    completedRounds: number;
    messageCount: number;
    activeStage: RunStage | null;
  };
  stages: VisualizationStage[];
  agents: VisualizationAgent[];
  activityFeed: VisualizationFeedEntry[];
  timeline: VisualizationTimelineRound[];
};

const STAGE_ORDER: RunStage[] = ["opening", "rebuttal", "summary", "final"];

function getExpectedRounds(detail: SessionDetailResponse): Record<RunStage, number> {
  return {
    opening: detail.session.debateIntensity,
    rebuttal: detail.session.debateIntensity,
    summary: 1,
    final: 1
  };
}

function getExpectedSpeakerCount(stage: RunStage, agentCount: number): number {
  if (stage === "summary" || stage === "final") {
    return 1;
  }

  return agentCount;
}

function getActiveStage(detail: SessionDetailResponse, isRunning: boolean, agentCount: number): RunStage | null {
  const expectedRounds = getExpectedRounds(detail);
  const lastRound = detail.rounds[detail.rounds.length - 1];

  if (!isRunning) {
    return null;
  }

  if (!lastRound) {
    return "opening";
  }

  const lastRoundExpectedSpeakers = getExpectedSpeakerCount(lastRound.stage, agentCount);
  if (lastRound.messages.length < lastRoundExpectedSpeakers) {
    return lastRound.stage;
  }

  for (const stage of STAGE_ORDER) {
    const stageRounds = detail.rounds.filter((round) => round.stage === stage);
    if (stageRounds.length < expectedRounds[stage]) {
      return stage;
    }
  }

  return lastRound.stage;
}

function getStageProgressRatio(input: {
  expectedRounds: number;
  completedRounds: number;
  isActiveStage: boolean;
  currentSpeakerCount: number;
  totalSpeakerCount: number;
}): number {
  if (input.expectedRounds <= 0) {
    return 0;
  }

  const partialRoundProgress =
    input.isActiveStage && input.totalSpeakerCount > 0 ? input.currentSpeakerCount / input.totalSpeakerCount : 0;

  return Math.min(1, (input.completedRounds + partialRoundProgress) / input.expectedRounds);
}

export function buildDebateVisualization(input: {
  detail: SessionDetailResponse;
  panel: PanelPreset | undefined;
  isRunning: boolean;
  liveMessages?: LiveMessageRecord[];
}): DebateVisualization {
  const panelAgents = input.panel?.agents ?? [];
  const expectedRounds = getExpectedRounds(input.detail);
  const activeStage = getActiveStage(input.detail, input.isRunning, panelAgents.length);
  const activeRound = activeStage
    ? [...input.detail.rounds].reverse().find((round) => round.stage === activeStage) ?? null
    : null;

  const liveMessagesByRound = new Map<string, LiveMessageRecord[]>();
  for (const message of input.liveMessages ?? []) {
    if (!message.roundId) {
      continue;
    }

    const existing = liveMessagesByRound.get(message.roundId) ?? [];
    existing.push(message);
    liveMessagesByRound.set(message.roundId, existing);
  }

  const timeline = input.detail.rounds.map((round): VisualizationTimelineRound => {
    const messageMap = new Map<string, VisualizationTimelineMessage>();

    for (const message of round.messages) {
      messageMap.set(message.id, {
        id: message.id,
        roundId: round.id,
        agentKey: message.agentKey,
        agentName: message.agentName,
        role: message.role,
        kind: message.kind,
        content: message.content,
        reasoning: "",
        createdAt: message.createdAt,
        isStreaming: false
      });
    }

    for (const message of liveMessagesByRound.get(round.id) ?? []) {
      const existing = messageMap.get(message.id);

      if (existing) {
        messageMap.set(message.id, {
          ...existing,
          reasoning: message.reasoning,
          isStreaming: false
        });
        continue;
      }

      messageMap.set(message.id, {
        id: message.id,
        roundId: message.roundId,
        agentKey: message.agentKey,
        agentName: message.agentName,
        role: message.role,
        kind: message.kind,
        content: message.content,
        reasoning: message.reasoning,
        createdAt: message.createdAt,
        isStreaming: message.status !== "complete"
      });
    }

    return {
      id: round.id,
      roundNumber: round.roundNumber,
      stage: round.stage,
      title: round.title,
      summary: round.summary,
      messages: Array.from(messageMap.values())
    };
  });

  const activeTimelineRound = activeRound ? timeline.find((round) => round.id === activeRound.id) ?? null : null;

  const stages = STAGE_ORDER.map((stage): VisualizationStage => {
    const stageRounds = input.detail.rounds.filter((round) => round.stage === stage);
    const totalSpeakerCount = getExpectedSpeakerCount(stage, panelAgents.length);
    const completedRounds = stageRounds.filter((round) => round.messages.length >= totalSpeakerCount).length;
    const isActiveStage = input.isRunning && activeStage === stage;
    const currentSpeakerCount = isActiveStage ? activeTimelineRound?.messages.length ?? 0 : 0;

    return {
      key: stage,
      expectedRounds: expectedRounds[stage],
      completedRounds,
      pendingRounds: Math.max(0, expectedRounds[stage] - completedRounds),
      status: isActiveStage ? "active" : completedRounds >= expectedRounds[stage] ? "completed" : "pending",
      progressRatio: getStageProgressRatio({
        expectedRounds: expectedRounds[stage],
        completedRounds,
        isActiveStage,
        currentSpeakerCount,
        totalSpeakerCount
      }),
      currentRoundNumber: isActiveStage ? activeRound?.roundNumber ?? null : null,
      currentSpeakerCount,
      totalSpeakerCount
    };
  });

  const activeRoundResponders = new Set((activeTimelineRound?.messages ?? []).map((message) => message.agentKey));
  const nextActiveAgentKey = panelAgents.find((agent) => !activeRoundResponders.has(agent.key))?.key ?? null;
  const contributionsByAgent = new Map<string, number>();
  for (const round of input.detail.rounds) {
    for (const message of round.messages) {
      contributionsByAgent.set(message.agentKey, (contributionsByAgent.get(message.agentKey) ?? 0) + 1);
    }
  }

  const agentStatusesAllowActive = activeStage === "opening" || activeStage === "rebuttal";

  const agents = panelAgents.map((agent): VisualizationAgent => {
    const contributionCount = contributionsByAgent.get(agent.key) ?? 0;

    return {
      agentKey: agent.key,
      agentName: agent.name,
      role: agent.role,
      contributionCount,
      status: agentStatusesAllowActive
        ? activeRoundResponders.has(agent.key)
          ? "done"
          : input.isRunning && nextActiveAgentKey === agent.key
            ? "active"
            : input.isRunning && activeStage !== null
              ? "queued"
              : contributionCount > 0
                ? "done"
                : "queued"
        : contributionCount > 0
          ? "done"
          : "queued"
    };
  });

  const activityFeed = timeline
    .flatMap((round) =>
      round.messages.map(
        (message): VisualizationFeedEntry => ({
          type: "message",
          id: message.id,
          stage: round.stage,
          agentKey: message.agentKey,
          agentName: message.agentName,
          kind: message.kind,
          label: message.content.split("\n")[0] ?? message.content,
          createdAt: message.createdAt,
          isStreaming: message.isStreaming
        })
      )
    )
    .slice(-5)
    .reverse();

  if (activityFeed.length === 0) {
    activityFeed.push({
      type: "system",
      stage: input.isRunning ? activeStage ?? "opening" : null
    });
  }

  const completedRounds = stages.reduce((total, stage) => total + stage.completedRounds, 0);

  return {
    summary: {
      expectedRounds: input.detail.session.roundCount,
      completedRounds,
      messageCount: timeline.reduce((total, round) => total + round.messages.length, 0),
      activeStage
    },
    stages,
    agents,
    activityFeed,
    timeline
  };
}
