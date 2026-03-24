import { useMemo, type FC } from "react";
import { CheckCircle2 } from "lucide-react";

import type { DebateVisualization } from "@/lib/council-visualization";
import { getAgentVisual } from "@/lib/council-agent-visuals";
import {
  getActivityFeedLabel,
  getAgentBoardLabel,
  getAgentStatusLabel,
  getContributionLabel,
  getLiveWorkspaceDescription,
  getLiveWorkspaceLabel,
  getProgressMetricLabel,
  getScrumBoardLabel,
  getSpeakerProgressLabel,
  getStageStatusLabel,
  getWaitingFeedLabel
} from "@/lib/council-app-labels";
import { cn } from "@/lib/utils";
import { getMessageKindLabel, getRoundStageLabel, getStatusLabel, type UiLocale, getUiCopy } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import type { PresetDefinition, SessionDetailResponse } from "@ship-council/shared";

type LiveWorkspacePanelProps = {
  copy: ReturnType<typeof getUiCopy>;
  uiLocale: UiLocale;
  detail: SessionDetailResponse;
  debateVisualization: DebateVisualization;
  activePreset: PresetDefinition | null | undefined;
  timelineTitle: string;
  isSelectedSessionRunning: boolean;
  onSelectMessage: (messageId: string) => void;
  onSelectAgent: (agentKey: string) => void;
};

export const LiveWorkspacePanel: FC<LiveWorkspacePanelProps> = ({
  copy,
  uiLocale,
  detail,
  debateVisualization,
  activePreset,
  timelineTitle,
  isSelectedSessionRunning,
  onSelectMessage,
  onSelectAgent
}) => {
  const latestFeedMessage = useMemo(
    () => debateVisualization.activityFeed.find((entry) => entry.type === "message") ?? null,
    [debateVisualization]
  );

  const activityFeedWithKeys = useMemo(() => {
    const keyCounts = new Map<string, number>();

    return debateVisualization.activityFeed.map((entry) => {
      const baseKey = entry.type === "message" ? `message-${entry.id}` : `system-${entry.stage ?? "idle"}`;
      const nextIndex = (keyCounts.get(baseKey) ?? 0) + 1;
      keyCounts.set(baseKey, nextIndex);
      const key = nextIndex === 1 ? baseKey : `${baseKey}-${nextIndex}`;

      return { entry, key };
    });
  }, [debateVisualization.activityFeed]);

  return (
    <div className="mb-6 flex flex-1 min-h-0 flex-col gap-4">
      <div className="flex flex-1 min-h-0 gap-4">
        <div className="flex w-[60%] min-w-[420px] max-w-[80%] flex-col gap-4 overflow-hidden">
          <div className="council-scrollbar h-fit shrink-0 overflow-y-auto rounded-3xl border border-blue-500/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_rgba(8,15,28,0.92)_70%)] px-5 py-3 shadow-[0_15px_50px_rgba(2,6,23,0.3)]">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-white shrink-0">
                {getLiveWorkspaceDescription(uiLocale, isSelectedSessionRunning)}
              </h3>
              <Badge className="px-1.5 py-0.5 text-[10px] border-blue-400/20 bg-blue-500/10 text-blue-300">
                {debateVisualization.summary.activeStage
                  ? getRoundStageLabel(debateVisualization.summary.activeStage, uiLocale)
                  : getStatusLabel(detail.run?.status ?? detail.session.status, uiLocale)}
              </Badge>
            </div>

            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/10 px-3 py-1.5">
                <span className="text-[10px] font-medium text-gray-500">{getProgressMetricLabel("expected", uiLocale)}</span>
                <span className="text-sm font-bold text-gray-200">{debateVisualization.summary.expectedRounds}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/10 px-3 py-1.5">
                <span className="text-[10px] font-medium text-gray-500">{getProgressMetricLabel("completed", uiLocale)}</span>
                <span className="text-sm font-bold text-gray-200">{debateVisualization.summary.completedRounds}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/10 px-3 py-1.5 overflow-hidden">
                <span className="text-[10px] font-medium text-gray-500 shrink-0 mr-2">{getProgressMetricLabel("stage", uiLocale)}</span>
                <span className="text-xs font-bold text-gray-200 truncate">
                  {debateVisualization.summary.activeStage
                    ? getRoundStageLabel(debateVisualization.summary.activeStage, uiLocale)
                    : getStatusLabel(detail.run?.status ?? detail.session.status, uiLocale)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/10 px-3 py-1.5 overflow-hidden">
                <span className="text-[10px] font-medium text-gray-500 shrink-0 mr-2">{getProgressMetricLabel("speaker", uiLocale)}</span>
                <span className="text-xs font-bold text-gray-200 truncate">
                  {latestFeedMessage ? latestFeedMessage.agentName : getWaitingFeedLabel(uiLocale, debateVisualization.summary.activeStage)}
                </span>
              </div>
            </div>

            <div className="mt-2.5">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-sm font-bold text-white">토론 진행 상황</h2>
                <div className="text-xs font-medium text-gray-400">
                  라운드 <span className="text-white">{debateVisualization.summary.completedRounds}</span> /{" "}
                  {debateVisualization.summary.expectedRounds}
                </div>
              </div>

              <div className="flex items-center justify-between px-2">
                {debateVisualization.stages.map((stage, idx) => {
                  const isActive = stage.status === "active";
                  const isCompleted = stage.status === "completed";
                  const isLast = idx === debateVisualization.stages.length - 1;

                  return (
                    <div key={stage.key} className={cn("flex items-center", !isLast && "flex-1")}>
                      <div className="flex flex-col items-center gap-2 relative z-10 shrink-0">
                        <div
                          className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
                            isCompleted
                              ? "bg-blue-600 border-blue-600 text-white"
                              : isActive
                                ? "bg-transparent border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                                : "bg-gray-800 border-gray-700 text-gray-500"
                          )}
                        >
                          {isCompleted ? (
                            <CheckCircle2 size={16} />
                          ) : isActive ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-xs font-medium whitespace-nowrap",
                            isActive || isCompleted ? "text-gray-300" : "text-gray-500"
                          )}
                        >
                          {getRoundStageLabel(stage.key, uiLocale)}
                        </span>
                      </div>
                      {!isLast && (
                        <div
                          className={cn(
                            "flex-1 h-[2px] mx-4 transition-colors rounded-full -mt-5",
                            isCompleted ? "bg-blue-600 font-bold" : "bg-gray-800"
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{getAgentBoardLabel(uiLocale)}</p>
                <Badge className="px-1.5 py-0.5 text-[10px] border-gray-700 bg-gray-900 text-gray-400">
                  {getContributionLabel(debateVisualization.summary.messageCount, uiLocale)}
                </Badge>
              </div>
            </div>

            <div className="council-scrollbar flex-1 overflow-y-auto pr-2">
              <div className="grid gap-2.5">
                {debateVisualization.agents.map((agent) => {
                  const visual = getAgentVisual(agent.agentKey, agent.role);
                  const Icon = visual.icon;

                  return (
                    <button
                      key={agent.agentKey}
                      onClick={() => onSelectAgent(agent.agentKey)}
                      className="group cursor-pointer rounded-2xl border border-gray-800/80 bg-[#121826]/40 px-4 py-3 text-left transition hover:border-blue-500/20 hover:bg-blue-500/5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors group-hover:border-blue-500/30", visual.bg, visual.border)}>
                            <Icon size={18} className={visual.color} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-100 transition-colors group-hover:text-blue-400">{agent.agentName}</p>
                            <p className="truncate text-xs text-gray-500">{agent.role}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <Badge
                            className={cn(
                              "border-0 px-1.5 py-0.5 text-[10px] font-medium",
                              agent.status === "active"
                                ? "bg-blue-500/10 text-blue-400"
                                : agent.status === "done"
                                  ? "bg-green-500/10 text-green-500"
                                  : "bg-gray-800/80 text-gray-500"
                            )}
                          >
                            {getAgentStatusLabel(agent.status, uiLocale)}
                          </Badge>
                          <p className="text-[10px] font-medium text-gray-500">{getContributionLabel(agent.contributionCount, uiLocale)}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="council-scrollbar min-w-0 flex-1 overflow-y-auto rounded-[28px] border border-gray-800 bg-gray-950/75 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">{getActivityFeedLabel(uiLocale)}</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{copy.detail.live}</h3>
            </div>
            <Badge className="border-gray-700 bg-gray-900 text-gray-300">
              {latestFeedMessage ? latestFeedMessage.kind : getStageStatusLabel("active", uiLocale)}
            </Badge>
          </div>

          <div className="mt-4 space-y-3">
            {activityFeedWithKeys.map(({ entry, key }) => (
              <div
                key={key}
                onClick={() => entry.type === "message" && onSelectMessage(entry.id)}
                className={cn(
                  "rounded-[20px] border border-gray-800 bg-gray-900/80 px-4 py-4",
                  entry.type === "message" && "group cursor-pointer transition hover:border-gray-700 hover:bg-gray-800/60"
                )}
              >
                {entry.type === "message" ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-100">{entry.agentName}</p>
                      <Badge className={cn("border-gray-700 bg-gray-800 text-gray-300", entry.isStreaming && "border-blue-400/20 bg-blue-500/10 text-blue-200")}>
                        {entry.isStreaming ? `${getRoundStageLabel(entry.stage, uiLocale)} · Live` : getRoundStageLabel(entry.stage, uiLocale)}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-300 transition-colors group-hover:text-gray-200">{entry.label}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-gray-500">{getMessageKindLabel(entry.kind, uiLocale)}</p>
                      <span className="flex items-center gap-1 text-xs text-blue-400 opacity-0 transition-opacity group-hover:opacity-100">
                        상세 보기
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm leading-6 text-gray-400">{getWaitingFeedLabel(uiLocale, entry.stage)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default LiveWorkspacePanel;
