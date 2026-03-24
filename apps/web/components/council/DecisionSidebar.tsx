import type { FC } from "react";
import { AlertTriangle, CheckCircle2, Clock, Cpu, Download, FileText, Info, RefreshCcw, Search, Sparkles, Zap } from "lucide-react";

import type { SessionDetailResponse } from "@ship-council/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { getRiskSectionLabel } from "@/lib/council-app-labels";
import { getDisplayRunStatusLabel } from "@/lib/council-app-helpers";
import { formatUiTimestamp, type UiLocale, getUiCopy } from "@/lib/i18n";

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

            {detail?.activityMetrics ? (
              <section className="mb-8 space-y-4">
                <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
                  <Sparkles size={16} className="text-blue-400" />
                  {copy.decision.metrics.title}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-3 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Zap size={12} className="text-yellow-500" />
                      {copy.decision.metrics.tokens}
                    </div>
                    <div className="text-sm font-semibold text-gray-200">
                      {(detail.activityMetrics.inputTokens + detail.activityMetrics.outputTokens).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-3 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock size={12} className="text-blue-400" />
                      {copy.decision.metrics.duration}
                    </div>
                    <div className="text-sm font-semibold text-gray-200">
                      {detail.activityMetrics.workDurationMs > 60000
                        ? `${(detail.activityMetrics.workDurationMs / 60000).toFixed(1)}m`
                        : `${(detail.activityMetrics.workDurationMs / 1000).toFixed(0)}s`}
                    </div>
                  </div>
                  <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-3 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Search size={12} className="text-cyan-400" />
                      {copy.decision.metrics.webSearches}
                    </div>
                    <div className="text-sm font-semibold text-gray-200">
                      {detail.activityMetrics.webSearches}
                    </div>
                  </div>
                  <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-3 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Cpu size={12} className="text-purple-400" />
                      {copy.decision.metrics.skillUses}
                    </div>
                    <div className="text-sm font-semibold text-gray-200">
                      {detail.activityMetrics.skillUses + detail.activityMetrics.mcpCalls}
                    </div>
                  </div>
                </div>
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
