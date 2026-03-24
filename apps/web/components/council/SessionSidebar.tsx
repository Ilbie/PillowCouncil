import type { FC } from "react";
import { Lightbulb, LoaderCircle } from "lucide-react";

import type { SessionSummary } from "@ship-council/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type UiLocale, getDebateIntensityLabel, getStatusLabel, getUiCopy, getUiLanguageLabel } from "@/lib/i18n";
import { getDisplayRunStatusLabel, getThinkingIntensityLabel } from "@/lib/council-app-helpers";

type SessionSidebarProps = {
  copy: ReturnType<typeof getUiCopy>;
  uiLocale: UiLocale;
  sessions: SessionSummary[];
  selectedId: string | null;
  activeRunSessionId: string | null;
  onOpenCreateSession: () => void;
  onSelectSession: (sessionId: string) => void;
};

export const SessionSidebar: FC<SessionSidebarProps> = ({
  copy,
  uiLocale,
  sessions,
  selectedId,
  activeRunSessionId,
  onOpenCreateSession,
  onSelectSession
}) => {
  return (
    <aside className="council-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col">
        <div className="sticky top-0 z-10 mb-3 w-full border-b border-gray-800/90 bg-[#121826]/95 p-4 pb-3 backdrop-blur">
          <Button
            className="h-11 w-full justify-start rounded-xl bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.2)] hover:bg-blue-500"
            onClick={onOpenCreateSession}
          >
            <Lightbulb size={16} className="mr-2" />
            {copy.session.title}
          </Button>
        </div>

        <section className="px-4 py-6">
          <div className="mb-4 px-1">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{copy.sessions.title}</h2>
          </div>

          <div className="space-y-3">
            {sessions.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-gray-800 bg-gray-900/50 p-5 text-sm text-gray-500">
                {copy.sessions.empty}
              </div>
            ) : null}
            {sessions.map((entry) => {
              const sessionRunning =
                entry.session.id === activeRunSessionId ||
                entry.run?.status === "running" ||
                entry.session.status === "running";

              return (
                <button
                  key={entry.session.id}
                  type="button"
                  onClick={() => onSelectSession(entry.session.id)}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left transition-all",
                    selectedId === entry.session.id
                      ? "bg-blue-600/10 border-blue-500/20"
                      : "border-transparent hover:bg-gray-800/50"
                  )}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className={cn("line-clamp-1 text-sm font-medium truncate", selectedId === entry.session.id ? "text-blue-400" : "text-gray-200")}>{entry.session.title}</p>
                    <Badge
                      className={cn(
                        "px-1.5 py-0.5 text-[10px] font-medium border-0",
                        sessionRunning
                          ? "bg-blue-500/10 text-blue-400"
                          : entry.run?.status === "completed" || entry.session.status === "completed"
                            ? "bg-green-500/10 text-green-500"
                            : "bg-gray-800/80 text-gray-500"
                      )}
                    >
                      {sessionRunning ? (
                        <span className="inline-flex items-center gap-1">
                          <LoaderCircle className="h-3 w-3 animate-spin" />
                          {getStatusLabel("running", uiLocale)}
                        </span>
                      ) : (
                        getDisplayRunStatusLabel({
                          status: entry.run?.status ?? entry.session.status,
                          errorMessage: entry.run?.errorMessage,
                          locale: uiLocale
                        })
                      )}
                    </Badge>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-gray-500 bg-gray-800/80 px-1.5 py-0.5 rounded-md">{entry.session.model}</span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-5 text-gray-500">{entry.session.prompt}</p>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );
};

export default SessionSidebar;
