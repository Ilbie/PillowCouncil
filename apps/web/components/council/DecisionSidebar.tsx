import type { FC } from "react";
import { AlertTriangle, Binary, CheckCircle2, Clock3, Download, FileText, Info, RefreshCcw, Search, Sparkles, Wand2 } from "lucide-react";

import type { SessionDetailResponse } from "@ship-council/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { getActivityMetricLabel, getActivityMetricsTitle, getRiskSectionLabel } from "@/lib/council-app-labels";
import { getDisplayRunStatusLabel } from "@/lib/council-app-helpers";
import { formatUiTimestamp, type UiLocale, getUiCopy } from "@/lib/i18n";

function formatDuration(durationMs: number): string {
  if (durationMs <= 0) {
    return "0s";
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

type DecisionSidebarProps = {
  copy: ReturnType<typeof getUiCopy>;
  uiLocale: UiLocale;
  detail: SessionDetailResponse | null;
  selectedId: string | null;
  isSubmitting: boolean;
  isStoppingRun: boolean;
  isSelectedSessionRunning: boolean;
  onRerun: () => void;
  onStop: () => void;
};

export const DecisionSidebar: FC<DecisionSidebarProps> = ({
  copy,
  uiLocale,
  detail,
  selectedId,
  isSubmitting,
  isStoppingRun,
  isSelectedSessionRunning,
  onRerun,
  onStop
}) => {
  const numberFormatter = new Intl.NumberFormat(uiLocale);
  const metricCards = detail
    ? [
        {
          key: "mcp",
          label: getActivityMetricLabel("mcp", uiLocale),
          value: numberFormatter.format(detail.activityMetrics.mcpCalls),
          icon: Binary,
          accent: "text-blue-300"
        },
        {
          key: "skills",
          label: getActivityMetricLabel("skills", uiLocale),
          value: numberFormatter.format(detail.activityMetrics.skillUses),
          icon: Wand2,
          accent: "text-violet-300"
        },
        {
          key: "web-search",
          label: getActivityMetricLabel("webSearch", uiLocale),
          value: numberFormatter.format(detail.activityMetrics.webSearches),
          icon: Search,
          accent: "text-cyan-300"
        },
        {
          key: "input-tokens",
          label: getActivityMetricLabel("inputTokens", uiLocale),
          value: numberFormatter.format(detail.activityMetrics.inputTokens),
          icon: Download,
          accent: "text-emerald-300"
        },
        {
          key: "output-tokens",
          label: getActivityMetricLabel("outputTokens", uiLocale),
          value: numberFormatter.format(detail.activityMetrics.outputTokens),
          icon: Sparkles,
          accent: "text-amber-300"
        },
        {
          key: "work-time",
          label: getActivityMetricLabel("workTime", uiLocale),
          value: formatDuration(detail.activityMetrics.workDurationMs),
          icon: Clock3,
          accent: "text-rose-300"
        }
      ]
    : [];

  return (
    <aside className="council-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-[#121826]">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Sparkles size={18} className="text-blue-400" />
          {copy.decision.title}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700/50"
            onClick={onRerun}
            disabled={!selectedId || isSubmitting || isStoppingRun || isSelectedSessionRunning}
          >
            <RefreshCcw size={14} />
          </Button>
          {selectedId ? (
            <a
              href={`/api/sessions/${selectedId}/export?format=json`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition-colors border border-gray-700/50"
            >
              <Download size={14} />
              JSON
            </a>
          ) : null}
        </div>
      </div>

      <div className="council-scrollbar flex-1 overflow-y-auto px-4 py-6">
        {detail ? (
          <section className="mb-8 rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_rgba(2,6,23,0.92)_65%)] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.28)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200/70">
                  {getActivityMetricsTitle(uiLocale)}
                </p>
                <h3 className="mt-2 text-sm font-semibold text-white">
                  {detail.session.title}
                </h3>
              </div>
              <Badge className="border-blue-400/20 bg-blue-500/10 text-blue-200">
                {getDisplayRunStatusLabel({
                  status: detail.run?.status ?? detail.session.status,
                  errorMessage: detail.run?.errorMessage ?? null,
                  locale: uiLocale
                })}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {metricCards.map((metric) => {
                const Icon = metric.icon;

                return (
                  <div
                    key={metric.key}
                    className="rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-medium text-gray-400">{metric.label}</span>
                      <Icon size={15} className={metric.accent} />
                    </div>
                    <p className="mt-2 text-lg font-semibold tracking-tight text-white">{metric.value}</p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {!detail?.decision ? (
          <div className="flex min-h-[560px] flex-col items-center justify-center rounded-[28px] border border-dashed border-gray-800 bg-gray-950/50 px-6 text-center">
            <Info size={32} className="mb-4 text-gray-700" />
            <p className="max-w-md text-sm leading-6 text-gray-500">{copy.decision.empty}</p>
          </div>
        ) : null}

        {detail?.decision ? (
          <div className="flex flex-col">
            <section className="mb-8 space-y-3">
              <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-500" />
                {copy.decision.topRecommendation}
              </h3>
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 text-sm text-gray-300 leading-relaxed">
                <MarkdownContent
                  content={detail.decision.topRecommendation}
                  className="text-sm text-gray-300 [&_p]:my-0"
                />
              </div>
            </section>

            <section className="mb-8 space-y-3">
              <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                <FileText size={16} className="text-gray-400" />
                {copy.decision.finalSummary}
              </h3>
              <MarkdownContent content={detail.decision.finalSummary} className="text-sm text-gray-400 leading-relaxed px-1" />
            </section>

            {detail.decision.risks.length > 0 ? (
              <section className="mb-8 space-y-3">
                <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {getRiskSectionLabel(uiLocale)}
                </h3>
                <ul className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-sm text-gray-300 space-y-3">
                  {detail.decision.risks.map((risk, index) => (
                    <li key={`${risk}-${index}`} className="flex items-start gap-2 text-sm leading-snug text-gray-300">
                      <span className="text-red-500 mt-0.5">•</span>
                      <MarkdownContent content={risk} className="flex-1 text-sm text-gray-300 [&_p]:my-0" />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {detail.run ? (
              <div className="rounded-[20px] border border-gray-800 bg-gray-950/80 px-4 py-3 text-sm text-gray-400">
                {copy.decision.status}: {getDisplayRunStatusLabel({
                  status: detail.run.status,
                  errorMessage: detail.run.errorMessage,
                  locale: uiLocale
                })} / {copy.decision.updated}: {formatUiTimestamp(detail.run.completedAt ?? detail.run.updatedAt, uiLocale)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
};

export default DecisionSidebar;
