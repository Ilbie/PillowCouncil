import type { FC } from "react";
import { Binary, Clock3, Download, Search, Sparkles, Wand2 } from "lucide-react";

import type { SessionDetailResponse } from "@ship-council/shared";

import { Badge } from "@/components/ui/badge";
import { getActivityMetricLabel, getActivityMetricsTitle } from "@/lib/council-app-labels";
import { getDisplayRunStatusLabel } from "@/lib/council-app-helpers";
import type { UiLocale } from "@/lib/i18n";

type SessionActivityMetricsCardProps = {
  detail: SessionDetailResponse;
  uiLocale: UiLocale;
  className?: string;
};

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

export const SessionActivityMetricsCard: FC<SessionActivityMetricsCardProps> = ({ detail, uiLocale, className }) => {
  const numberFormatter = new Intl.NumberFormat(uiLocale);
  const metricCards = [
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
  ];

  return (
    <section className={className ?? "rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_rgba(2,6,23,0.92)_65%)] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.28)]"}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200/70">
            {getActivityMetricsTitle(uiLocale)}
          </p>
          <h3 className="mt-2 text-sm font-semibold text-white">{detail.session.title}</h3>
        </div>
        <Badge className="border-blue-400/20 bg-blue-500/10 text-blue-200">
          {getDisplayRunStatusLabel({
            status: detail.run?.status ?? detail.session.status,
            errorMessage: detail.run?.errorMessage ?? null,
            locale: uiLocale
          })}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metricCards.map((metric) => {
          const Icon = metric.icon;

          return (
            <div key={metric.key} className="rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 backdrop-blur-sm">
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
  );
};

export default SessionActivityMetricsCard;
