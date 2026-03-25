import {
  GENERATED_PRESET_AGENT_COUNT_DEFAULT,
  GENERATED_PRESET_AGENT_COUNT_MAX,
  GENERATED_PRESET_AGENT_COUNT_MIN
} from "@pillow-council/agents";
import type { ProviderConnectionState } from "@pillow-council/providers";
import type { LiveMessageRecord, PresetDefinition, ProviderOption, RunStreamEvent, SessionSummary, ThinkingIntensity } from "@pillow-council/shared";
import { getStatusLabel, type UiLocale } from "@/lib/i18n";
import { pickPreferredAuthModeId } from "@/lib/provider-auth";

export type ConnectionDraft = {
  providerId: string;
  authMode: string;
  apiKey: string;
};

export function isMatchingSessionRunEvent(
  payload: Pick<RunStreamEvent, "sessionId" | "runId">,
  sessionId: string | null,
  runId: string | null
): boolean {
  if (sessionId === null || runId === null) {
    return false;
  }

  return payload.sessionId === sessionId && payload.runId === runId;
}

export type LiveMessageMap = Record<string, LiveMessageRecord>;

const DEBATE_INTENSITY_MIN = 1;
const DEBATE_INTENSITY_MAX = 20;
const DEBATE_INTENSITY_DEFAULT = 2;
const RUN_STOPPED_BY_USER_MESSAGE = "Run stopped by user.";

export function buildAvailablePresets(initialPresets: PresetDefinition[], generatedPreset: PresetDefinition | null): PresetDefinition[] {
  if (!generatedPreset) {
    return initialPresets;
  }

  return [...initialPresets.filter((preset) => preset.id !== generatedPreset.id), generatedPreset];
}

export function mergePersistedPresets(basePresets: PresetDefinition[], persistedPresets: PresetDefinition[]): PresetDefinition[] {
  const merged = new Map(basePresets.map((preset) => [preset.id, preset]));

  for (const preset of persistedPresets) {
    merged.set(preset.id, preset);
  }

  return [...merged.values()];
}

export function resolveCustomPresetForSessionCreate(input: {
  presetId: string;
  selectedPreset: PresetDefinition | null | undefined;
}): PresetDefinition | undefined {
  if (!input.selectedPreset || input.selectedPreset.id !== input.presetId || !input.presetId.startsWith("custom:")) {
    return undefined;
  }

  return input.selectedPreset;
}

export function filterLiveMessagesForSessionRun(messages: LiveMessageMap, sessionId: string, runId: string | null): LiveMessageMap {
  return Object.fromEntries(
    Object.entries(messages).filter(([, message]) => message.sessionId !== sessionId || (runId !== null && message.runId === runId))
  );
}

export function removeLiveMessagesForSession(messages: LiveMessageMap, sessionId: string): LiveMessageMap {
  return Object.fromEntries(Object.entries(messages).filter(([, message]) => message.sessionId !== sessionId));
}

export function mergeSessionPages(current: SessionSummary[], incoming: SessionSummary[]): SessionSummary[] {
  const merged = new Map(current.map((entry) => [entry.session.id, entry]));
  for (const entry of incoming) {
    merged.set(entry.session.id, entry);
  }

  return [...merged.values()].sort((left, right) => right.session.updatedAt.localeCompare(left.session.updatedAt));
}

export function getNextSelectedSessionIdAfterDelete(
  sessions: SessionSummary[],
  deletedSessionId: string,
  selectedSessionId: string | null
): string | null {
  if (selectedSessionId !== deletedSessionId) {
    return selectedSessionId;
  }

  return sessions.find((entry) => entry.session.id !== deletedSessionId)?.session.id ?? null;
}

export function clampDebateIntensity(value: number): number {
  if (!Number.isFinite(value)) {
    return DEBATE_INTENSITY_DEFAULT;
  }

  return Math.min(DEBATE_INTENSITY_MAX, Math.max(DEBATE_INTENSITY_MIN, Math.trunc(value)));
}

export function isSameConnection(left: ConnectionDraft, right: ConnectionDraft): boolean {
  return left.providerId === right.providerId && left.authMode === right.authMode;
}

export function reconcileConnection(
  catalog: ProviderOption[],
  current: ConnectionDraft,
  fallback: { providerId: string; authMode: string }
): ConnectionDraft {
  const provider =
    catalog.find((item) => item.id === current.providerId) ??
    catalog.find((item) => item.id === fallback.providerId) ??
    catalog[0];
  const authMode =
    provider?.authModes.find((item) => item.id === current.authMode)?.id ??
    provider?.authModes.find((item) => item.id === fallback.authMode)?.id ??
    (provider ? pickPreferredAuthModeId(provider.authModes, current.authMode) : "") ??
    "";

  return {
    ...current,
    providerId: provider?.id ?? "",
    authMode
  };
}

export function getThinkingIntensityLabel(value: ThinkingIntensity, locale: UiLocale): string {
  const normalized = value.trim().toLowerCase();

  switch (locale) {
    case "ko":
      return normalized === "low"
        ? "낮음"
        : normalized === "medium"
          ? "중간"
          : normalized === "deep" || normalized === "high"
            ? "깊게"
            : normalized === "balanced" || normalized === "default"
              ? "균형"
              : value;
    case "ja":
      return normalized === "low"
        ? "低め"
        : normalized === "medium"
          ? "中間"
          : normalized === "deep" || normalized === "high"
            ? "深め"
            : normalized === "balanced" || normalized === "default"
              ? "バランス"
              : value;
    default:
      return normalized === "low"
        ? "Low"
        : normalized === "medium"
          ? "Medium"
          : normalized === "deep" || normalized === "high"
            ? "High"
            : normalized === "balanced" || normalized === "default"
              ? "Balanced"
              : value
                .split(/[-_/ ]+/)
                .filter(Boolean)
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(" ");
  }
}

export function getThinkingIntensityDescription(value: ThinkingIntensity, locale: UiLocale): string {
  const normalized = value.trim().toLowerCase();

  switch (locale) {
    case "ko":
      return normalized === "low"
        ? "짧고 빠르게 결론에 접근합니다."
        : normalized === "deep" || normalized === "high"
          ? "가정과 트레이드오프를 더 깊게 검토합니다."
          : normalized === "medium"
            ? "속도와 깊이 사이에서 조금 더 신중하게 검토합니다."
            : "속도와 깊이를 균형 있게 맞춥니다.";
    case "ja":
      return normalized === "low"
        ? "短く素早く結論に寄せます。"
        : normalized === "deep" || normalized === "high"
          ? "前提とトレードオフをより深く検討します。"
          : normalized === "medium"
            ? "速度と深さのあいだで少し慎重に検討します。"
            : "速度と深さのバランスを取ります。";
    default:
      return normalized === "low"
        ? "Keep the reasoning short and converge quickly."
        : normalized === "deep" || normalized === "high"
          ? "Push deeper on assumptions and tradeoffs."
          : normalized === "medium"
            ? "Add a bit more deliberate reasoning before deciding."
            : "Balance speed with reasoning depth.";
  }
}

export function clampAgentCount(value: number): number {
  if (!Number.isFinite(value)) {
    return GENERATED_PRESET_AGENT_COUNT_DEFAULT;
  }

  return Math.min(GENERATED_PRESET_AGENT_COUNT_MAX, Math.max(GENERATED_PRESET_AGENT_COUNT_MIN, Math.trunc(value)));
}

export function getDisplayRunStatusLabel(input: {
  status: string;
  errorMessage?: string | null;
  locale: UiLocale;
}): string {
  if (input.errorMessage === RUN_STOPPED_BY_USER_MESSAGE) {
    return getStatusLabel("stopped", input.locale);
  }

  return getStatusLabel(input.status, input.locale);
}

export async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

export function shouldRefreshProviderCatalogOnMount(providerOptions: Array<unknown>): boolean {
  return providerOptions.length === 0;
}

export function shouldRefreshDraftConnectionState(input: {
  providerId: string;
  authMode: string;
  currentState: {
    providerId: string;
    authModeId: string;
    [key: string]: unknown;
  };
}): boolean {
  return input.providerId !== input.currentState.providerId || input.authMode !== input.currentState.authModeId;
}

export function shouldRefreshSavedConnectionStateOnMount(input: {
  providerId: string;
  authMode: string;
  currentState: {
    providerId: string;
    authModeId: string;
    connected: boolean;
    available: boolean;
  };
}): boolean {
  if (!input.providerId || !input.authMode) {
    return false;
  }

  return (
    input.providerId !== input.currentState.providerId ||
    input.authMode !== input.currentState.authModeId ||
    !input.currentState.available
  );
}

export function shouldRefreshSessionListForRunSync(input: {
  source: "poll" | "manual" | "stream";
  isRunning: boolean;
}): boolean {
  return input.source !== "poll" || !input.isRunning;
}

export function deriveConnectionStateFromProviderOptions(
  providerOptions: ProviderOption[],
  providerId: string,
  authMode: string
): ProviderConnectionState {
  const provider = providerOptions.find((entry) => entry.id === providerId);
  return {
    providerId,
    authModeId: authMode,
    connected: provider?.connected ?? false,
    available: provider?.authModes.some((entry) => entry.id === authMode) ?? false
  };
}

export function isGeneratedPresetSourceCurrent(input: {
  source: {
    prompt: string;
    agentCount: number;
    language: string;
    model: string;
    providerId: string;
  };
  current: {
    prompt: string;
    agentCount: number;
    language: string;
    model: string;
    providerId: string;
  };
}): boolean {
  return (
    input.source.prompt === input.current.prompt &&
    input.source.agentCount === input.current.agentCount &&
    input.source.language === input.current.language &&
    input.source.model === input.current.model &&
    input.source.providerId === input.current.providerId
  );
}
