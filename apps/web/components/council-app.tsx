"use client";

import {
  Activity,
  Settings,
  X,
  AlertOctagon,
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Download,
  Hexagon,
  Info,
  Lightbulb,
  LoaderCircle,
  LogIn,
  RefreshCcw,
  Save,
  Shield,
  ShieldAlert,
  Users,
  Wifi,
  Zap
} from "lucide-react";
import type { ChangeEvent } from "react";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import {
  GENERATED_PRESET_AGENT_COUNT_DEFAULT,
  GENERATED_PRESET_AGENT_COUNT_MAX,
  GENERATED_PRESET_AGENT_COUNT_MIN
} from "@ship-council/agents";
import type { ProviderConnectionState } from "@ship-council/providers";

import { getModelThinkingOptions } from "@ship-council/shared/types";
import type {
  AppSettings,
  LiveMessageRecord,
  PresetDefinition,
  ProviderOption,
  RunStreamEvent,
  SessionCreateInput,
  SessionDetailResponse,
  SessionLanguage,
  SessionSummary,
  ThinkingIntensity
} from "@ship-council/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type UiLocale,
  UI_LOCALE_OPTIONS,
  UI_LOCALE_STORAGE_KEY,
  formatUiTimestamp,
  getDebateIntensityDescription,
  getDebateIntensityLabel,
  getMessageKindLabel,
  getPreferredUiLocale,
  getRoundStageLabel,
  getStatusLabel,
  getUiCopy,
  getUiLanguageLabel,
  isUiLocale
} from "@/lib/i18n";
import {
  beginProviderOauthFlow,
  pickPreferredAuthModeId,
  type ProviderOauthPendingState,
  waitForOauthAutoCompletion
} from "@/lib/provider-auth";
import { buildDebateVisualization } from "@/lib/council-visualization";
import { cn } from "@/lib/utils";

type CouncilAppProps = {
  initialPresets: PresetDefinition[];
  initialSessions: SessionSummary[];
  initialSettings: AppSettings;
  initialConnection: ProviderConnectionState;
  providerOptions: ProviderOption[];
  defaultProvider: string;
  defaultModel: string;
  defaultAuthMode: string;
};

type ConnectionDraft = {
  providerId: string;
  authMode: string;
  apiKey: string;
};
type SessionFormState = Pick<
  SessionCreateInput,
  "title" | "prompt" | "presetId" | "model" | "thinkingIntensity" | "debateIntensity" | "language"
>;

type GeneratedPresetResponse = {
  preset: PresetDefinition;
};

type PendingOauthState = ProviderOauthPendingState;

type RunRouteResponse = {
  runId: string;
  run: {
    status: string;
    errorMessage: string | null;
  };
};

type LiveMessageMap = Record<string, LiveMessageRecord>;

export function filterLiveMessagesForSessionRun(messages: LiveMessageMap, sessionId: string, runId: string | null): LiveMessageMap {
  return Object.fromEntries(
    Object.entries(messages).filter(([, message]) => message.sessionId !== sessionId || (runId !== null && message.runId === runId))
  );
}

export function removeLiveMessagesForSession(messages: LiveMessageMap, sessionId: string): LiveMessageMap {
  return Object.fromEntries(Object.entries(messages).filter(([, message]) => message.sessionId !== sessionId));
}

const POLL_INTERVAL_MS = 1_500;
const RUN_STOPPED_BY_USER_MESSAGE = "Run stopped by user.";
const SESSION_LANGUAGE_VALUES: SessionLanguage[] = ["ko", "en", "ja"];
const DEBATE_INTENSITY_MIN = 1;
const DEBATE_INTENSITY_MAX = 5;
const DEBATE_INTENSITY_DEFAULT = 2;
const CUSTOM_PRESET_AGENT_COUNT_DEFAULT = GENERATED_PRESET_AGENT_COUNT_DEFAULT;

const DYNAMIC_AGENT_VISUALS = [
  { icon: Briefcase, color: "text-sky-300", bg: "bg-sky-500/10", border: "border-sky-500/20" },
  { icon: Cpu, color: "text-violet-300", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  { icon: Lightbulb, color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { icon: Shield, color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { icon: Users, color: "text-rose-300", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  { icon: Zap, color: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/20" }
] as const;

const AGENT_VISUALS = {
  founder: { icon: Briefcase, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  user: { icon: Users, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  "staff-engineer": { icon: Cpu, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  growth: { icon: Zap, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  skeptic: { icon: AlertOctagon, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  pm: { icon: Briefcase, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  engineer: { icon: Cpu, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  designer: { icon: Lightbulb, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20" },
  security: { icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  performance: { icon: Activity, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  maintainer: { icon: ShieldAlert, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" }
} as const;

function getKeywordVisual(role: string) {
  const normalized = role.toLowerCase();

  if (normalized.includes("security") || normalized.includes("보안")) {
    return AGENT_VISUALS.security;
  }
  if (normalized.includes("design") || normalized.includes("ux") || normalized.includes("디자인")) {
    return AGENT_VISUALS.designer;
  }
  if (normalized.includes("engineer") || normalized.includes("개발") || normalized.includes("아키텍처")) {
    return AGENT_VISUALS["staff-engineer"];
  }
  if (normalized.includes("growth") || normalized.includes("marketing") || normalized.includes("마케팅")) {
    return AGENT_VISUALS.growth;
  }
  if (normalized.includes("skeptic") || normalized.includes("review") || normalized.includes("회의") || normalized.includes("risk")) {
    return AGENT_VISUALS.skeptic;
  }
  if (normalized.includes("user") || normalized.includes("customer") || normalized.includes("고객") || normalized.includes("사용자")) {
    return AGENT_VISUALS.user;
  }
  if (normalized.includes("product") || normalized.includes("pm") || normalized.includes("전략")) {
    return AGENT_VISUALS.pm;
  }

  return null;
}

function getAgentVisual(agentKey: string, role?: string) {
  const fromKey = AGENT_VISUALS[agentKey as keyof typeof AGENT_VISUALS];
  if (fromKey) {
    return fromKey;
  }

  const fromRole = role ? getKeywordVisual(role) : null;
  if (fromRole) {
    return fromRole;
  }

  const hash = [...`${agentKey}:${role ?? ""}`].reduce((total, char) => total + char.charCodeAt(0), 0);
  return DYNAMIC_AGENT_VISUALS[hash % DYNAMIC_AGENT_VISUALS.length];
}

function clampDebateIntensity(value: number): number {
  if (!Number.isFinite(value)) {
    return DEBATE_INTENSITY_DEFAULT;
  }

  return Math.min(DEBATE_INTENSITY_MAX, Math.max(DEBATE_INTENSITY_MIN, Math.trunc(value)));
}

function isSameConnection(left: ConnectionDraft, right: ConnectionDraft): boolean {
  return left.providerId === right.providerId && left.authMode === right.authMode;
}

function reconcileConnection(
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

function getSessionSectionDescription(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "주제, 프리셋, 모델, 언어, 토론 반복 횟수, 생각 강도를 정한 뒤 바로 실행합니다.";
    case "ja":
      return "テーマ、プリセット、モデル、言語、討論回数、思考強度を設定してすぐ実行します。";
    default:
      return "Set the topic, preset, model, language, debate cycles, and thinking intensity, then run immediately.";
  }
}

function getConnectionSectionDescription(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "OpenCode에서 공급사와 로그인 방식만 관리합니다. 모델은 새 세션에서 고릅니다.";
    case "ja":
      return "OpenCode ではプロバイダーとログイン方法だけを管理します。モデルは新しいセッションで選択します。";
    default:
      return "OpenCode manages the provider and login method only. Pick the model inside each new session.";
  }
}

function getDecisionSectionDescription(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "최종 결론과 핵심 리스크만 남깁니다.";
    case "ja":
      return "最終結論と主要リスクだけを表示します。";
    default:
      return "Keep only the final decision and the key risks.";
  }
}

function getSessionModelLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "세션 모델";
    case "ja":
      return "セッションモデル";
    default:
      return "Session model";
  }
}

function getSessionModelHint(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "저장된 공급사 기준으로 이번 세션에서 사용할 모델을 고릅니다.";
    case "ja":
      return "保存したプロバイダーの中から今回のセッションで使うモデルを選びます。";
    default:
      return "Choose which model to use for this session under the saved provider.";
  }
}

function getThinkingIntensityLabel(value: ThinkingIntensity, locale: UiLocale): string {
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

function getThinkingIntensityDescription(value: ThinkingIntensity, locale: UiLocale): string {
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

function getThinkingFieldLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "생각 강도";
    case "ja":
      return "思考強度";
    default:
      return "Thinking intensity";
  }
}

function getThinkingFieldHint(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "한 번의 발언에서 얼마나 깊게 검토할지 정합니다.";
    case "ja":
      return "各発言でどれだけ深く考えるかを決めます。";
    default:
      return "Controls how deeply each response should reason before answering.";
  }
}

function getRiskSectionLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "리스크";
    case "ja":
      return "リスク";
    default:
      return "Risks";
  }
}

function getLiveWorkspaceLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "라이브 워룸";
    case "ja":
      return "ライブ討論ルーム";
    default:
      return "Live War Room";
  }
}

function getLiveWorkspaceDescription(locale: UiLocale, isRunning: boolean): string {
  switch (locale) {
    case "ko":
      return isRunning
        ? "라운드가 생기기 전에도 현재 단계, 최근 발언, 패널 진행도를 실시간으로 추적합니다."
        : "선택한 세션의 토론 진행도와 패널 활동을 한눈에 확인합니다.";
    case "ja":
      return isRunning
        ? "ラウンドが作成される前でも、現在の段階、最新発言、パネル進行度を追跡します。"
        : "選択したセッションの討論進行とパネル活動をひと目で確認します。";
    default:
      return isRunning
        ? "Track the current stage, latest update, and panel momentum even before the first round lands."
        : "See the debate progress and panel activity for the selected session at a glance.";
  }
}

function getScrumBoardLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "스크럼 단계";
    case "ja":
      return "スクラム段階";
    default:
      return "Scrum Stages";
  }
}

function getActivityFeedLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "실시간 피드";
    case "ja":
      return "ライブフィード";
    default:
      return "Live Feed";
  }
}

function getAgentBoardLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "패널 활동";
    case "ja":
      return "パネル活動";
    default:
      return "Panel Activity";
  }
}

function getProgressMetricLabel(metric: "expected" | "completed" | "stage" | "speaker", locale: UiLocale): string {
  switch (metric) {
    case "expected":
      switch (locale) {
        case "ko":
          return "예정 라운드";
        case "ja":
          return "予定ラウンド";
        default:
          return "Planned Rounds";
      }
    case "completed":
      switch (locale) {
        case "ko":
          return "완료 라운드";
        case "ja":
          return "完了ラウンド";
        default:
          return "Completed";
      }
    case "stage":
      switch (locale) {
        case "ko":
          return "현재 단계";
        case "ja":
          return "現在の段階";
        default:
          return "Current Stage";
      }
    default:
      switch (locale) {
        case "ko":
          return "최근 발언";
        case "ja":
          return "最新発言";
        default:
          return "Latest Speaker";
      }
  }
}

function getStageStatusLabel(status: "pending" | "active" | "completed", locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return status === "active" ? "진행 중" : status === "completed" ? "완료" : "대기";
    case "ja":
      return status === "active" ? "進行中" : status === "completed" ? "完了" : "待機";
    default:
      return status === "active" ? "Active" : status === "completed" ? "Done" : "Pending";
  }
}

function getAgentStatusLabel(status: "queued" | "active" | "done", locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return status === "active" ? "발언 차례" : status === "done" ? "발언 완료" : "대기";
    case "ja":
      return status === "active" ? "発言中" : status === "done" ? "完了" : "待機";
    default:
      return status === "active" ? "Speaking" : status === "done" ? "Done" : "Queued";
  }
}

function getSpeakerProgressLabel(current: number, total: number, locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return `${current}/${total}명 발언`;
    case "ja":
      return `${current}/${total}人が発言`;
    default:
      return `${current}/${total} speakers`;
  }
}

function getContributionLabel(count: number, locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return `${count}개 메시지`;
    case "ja":
      return `${count}件の発言`;
    default:
      return `${count} messages`;
  }
}

function getWaitingFeedLabel(locale: UiLocale, stage: string | null): string {
  const stageLabel = stage ? getRoundStageLabel(stage, locale) : null;

  switch (locale) {
    case "ko":
      return stageLabel ? `${stageLabel} 단계 응답을 기다리는 중입니다.` : "첫 응답을 기다리는 중입니다.";
    case "ja":
      return stageLabel ? `${stageLabel} 段階の応答を待っています。` : "最初の応答を待っています。";
    default:
      return stageLabel ? `Waiting for ${stageLabel} responses.` : "Waiting for the first response.";
  }
}

function clampAgentCount(value: number): number {
  if (!Number.isFinite(value)) {
    return CUSTOM_PRESET_AGENT_COUNT_DEFAULT;
  }

  return Math.min(GENERATED_PRESET_AGENT_COUNT_MAX, Math.max(GENERATED_PRESET_AGENT_COUNT_MIN, Math.trunc(value)));
}

function getDisplayRunStatusLabel(input: {
  status: string;
  errorMessage?: string | null;
  locale: UiLocale;
}): string {
  if (input.errorMessage === RUN_STOPPED_BY_USER_MESSAGE) {
    return getStatusLabel("stopped", input.locale);
  }

  return getStatusLabel(input.status, input.locale);
}

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
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

export function CouncilApp({
  initialPresets,
  initialSessions,
  initialSettings,
  initialConnection,
  providerOptions: initialProviderOptions,
  defaultProvider,
  defaultModel,
  defaultAuthMode
}: CouncilAppProps) {
  const timelineEndRef = useRef<HTMLDivElement | null>(null);
  const oauthPopupRef = useRef<Window | null>(null);
  const [uiLocale, setUiLocale] = useState<UiLocale>("ko");
  const [sessions, setSessions] = useState(initialSessions);
  const [providerOptions, setProviderOptions] = useState(initialProviderOptions);
  const [selectedId, setSelectedId] = useState(initialSessions[0]?.session.id ?? null);
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [liveMessages, setLiveMessages] = useState<LiveMessageMap>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [isStoppingRun, setIsStoppingRun] = useState(false);
  const [savedSettings, setSavedSettings] = useState<AppSettings>(initialSettings);
  const [savedConnectionState, setSavedConnectionState] = useState<ProviderConnectionState>(initialConnection);
  const [draftConnectionState, setDraftConnectionState] = useState<ProviderConnectionState>(initialConnection);
  const [activeRunSessionId, setActiveRunSessionId] = useState<string | null>(
    initialSessions.find((entry) => entry.run?.status === "running")?.session.id ?? null
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const [pendingOauth, setPendingOauth] = useState<PendingOauthState | null>(null);
  const [isGeneratingPreset, setIsGeneratingPreset] = useState(false);
  const [generatedPresetPrompt, setGeneratedPresetPrompt] = useState("");
  const [generatedPresetAgentCount, setGeneratedPresetAgentCount] = useState(CUSTOM_PRESET_AGENT_COUNT_DEFAULT);
  const [generatedPreset, setGeneratedPreset] = useState<PresetDefinition | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>({
    providerId: initialSettings.providerId,
    authMode: initialSettings.authMode,
    apiKey: ""
  });
  const [form, setForm] = useState<SessionFormState>({
    title: "",
    prompt: "",
    presetId: initialPresets[0]?.id ?? "saas-founder",
    model: initialSettings.modelId || defaultModel,
    thinkingIntensity: "balanced",
    debateIntensity: DEBATE_INTENSITY_DEFAULT,
    language: "ko"
  });

  const copy = useMemo(() => getUiCopy(uiLocale), [uiLocale]);
  const availablePresets = useMemo(() => {
    if (!generatedPreset) {
      return initialPresets;
    }

    return [...initialPresets.filter((preset) => preset.id !== generatedPreset.id), generatedPreset];
  }, [generatedPreset, initialPresets]);
  const sessionLanguageOptions = useMemo(
    () =>
      SESSION_LANGUAGE_VALUES.map((value) => ({
        value,
        label: getUiLanguageLabel(value, uiLocale),
        description: copy.languages[value].description
      })),
    [copy.languages, uiLocale]
  );
  const selectedPreset = useMemo(
    () => availablePresets.find((preset) => preset.id === form.presetId) ?? availablePresets[0],
    [availablePresets, form.presetId]
  );
  const selectedLanguage = useMemo(
    () => sessionLanguageOptions.find((option) => option.value === form.language) ?? sessionLanguageOptions[0],
    [form.language, sessionLanguageOptions]
  );
  const selectedDebateIntensityLabel = useMemo(
    () => getDebateIntensityLabel(form.debateIntensity, uiLocale),
    [form.debateIntensity, uiLocale]
  );
  const selectedDebateIntensityDescription = useMemo(
    () => getDebateIntensityDescription(form.debateIntensity, uiLocale),
    [form.debateIntensity, uiLocale]
  );

  const connectionProvider = useMemo(
    () => providerOptions.find((provider) => provider.id === connectionDraft.providerId) ?? providerOptions[0],
    [connectionDraft.providerId, providerOptions]
  );
  const connectionAuthOption = useMemo(
    () =>
      connectionProvider?.authModes.find((option) => option.id === connectionDraft.authMode) ??
      connectionProvider?.authModes[0],
    [connectionDraft.authMode, connectionProvider]
  );
  const savedProvider = useMemo(
    () => providerOptions.find((provider) => provider.id === savedSettings.providerId) ?? null,
    [providerOptions, savedSettings.providerId]
  );
  const savedAuthOption = useMemo(
    () => savedProvider?.authModes.find((option) => option.id === savedSettings.authMode) ?? savedProvider?.authModes[0] ?? null,
    [savedProvider, savedSettings.authMode]
  );

  const hasProviders = providerOptions.length > 0;
  const isProviderConnected =
    draftConnectionState.providerId === connectionDraft.providerId &&
    draftConnectionState.authModeId === connectionDraft.authMode &&
    draftConnectionState.available &&
    draftConnectionState.connected;
  const hasPendingApiKey = connectionAuthOption?.type === "api" && connectionDraft.apiKey.trim().length > 0;
  const isConnectionDirty =
    hasPendingApiKey ||
    !isSameConnection(connectionDraft, {
      providerId: savedSettings.providerId,
      authMode: savedSettings.authMode,
      apiKey: ""
    });
  const sessionProviderId = savedSettings.providerId || connectionDraft.providerId;
  const sessionProvider = useMemo(
    () => providerOptions.find((provider) => provider.id === sessionProviderId) ?? savedProvider ?? connectionProvider ?? null,
    [connectionProvider, providerOptions, savedProvider, sessionProviderId]
  );
  const sessionModelOptions = sessionProvider?.models ?? [];
  const sessionModel = useMemo(
    () => sessionModelOptions.find((model) => model.id === form.model) ?? sessionModelOptions[0] ?? null,
    [form.model, sessionModelOptions]
  );
  const thinkingOptions = useMemo(() => getModelThinkingOptions(sessionModel), [sessionModel]);
  const selectedThinkingOption = useMemo(
    () => thinkingOptions.find((option) => option.value === form.thinkingIntensity) ?? thinkingOptions[0],
    [form.thinkingIntensity, thinkingOptions]
  );
  const selectedThinkingIntensityLabel = useMemo(
    () => selectedThinkingOption?.label ?? getThinkingIntensityLabel(form.thinkingIntensity, uiLocale),
    [form.thinkingIntensity, selectedThinkingOption, uiLocale]
  );
  const selectedThinkingIntensityDescription = useMemo(
    () => selectedThinkingOption?.description ?? getThinkingIntensityDescription(form.thinkingIntensity, uiLocale),
    [form.thinkingIntensity, selectedThinkingOption, uiLocale]
  );
  const isSelectedSessionRunning = Boolean(
    selectedId && (activeRunSessionId === selectedId || detail?.run?.status === "running")
  );

  const prunePersistedLiveMessages = (payload: SessionDetailResponse) => {
    const persistedIds = new Set(payload.rounds.flatMap((round) => round.messages.map((message) => message.id)));

    setLiveMessages((current) => {
      const scoped = filterLiveMessagesForSessionRun(current, payload.session.id, payload.run?.id ?? null);
      const nextEntries = Object.entries(scoped).filter(([messageId, message]) => {
        if (message.sessionId !== payload.session.id) {
          return true;
        }

        if (persistedIds.has(messageId)) {
          return false;
        }

        return payload.run?.status === "running";
      });

      return Object.fromEntries(nextEntries);
    });
  };

  const refreshSessions = async () => {
    const list = await readJson<SessionSummary[]>("/api/sessions");
    setSessions(list);
    if (!selectedId && list[0]) {
      setSelectedId(list[0].session.id);
    }
    return list;
  };

  const refreshDetail = async (sessionId: string) => {
    const payload = await readJson<SessionDetailResponse>(`/api/sessions/${sessionId}`);
    prunePersistedLiveMessages(payload);
    setDetail((current) => {
      if (selectedId === sessionId || current?.session.id === sessionId) {
        return payload;
      }
      return current;
    });
    return payload;
  };

  const syncSessionState = async (sessionId: string) => {
    const [, payload] = await Promise.all([refreshSessions(), refreshDetail(sessionId)]);
    if (payload.run && payload.run.status !== "running") {
      setActiveRunSessionId((current) => (current === sessionId ? null : current));
      if (
        payload.run?.status === "failed" &&
        payload.run.errorMessage &&
        payload.run.errorMessage !== RUN_STOPPED_BY_USER_MESSAGE
      ) {
        setError(payload.run.errorMessage);
      }
    }
    return payload;
  };

  const refreshProviderCatalog = async () => {
    setIsRefreshingModels(true);
    try {
      const catalog = await readJson<ProviderOption[]>(`/api/providers/models?ts=${Date.now()}`);
      setProviderOptions(catalog);
      if (catalog.length > 0) {
        setConnectionDraft((current) =>
          reconcileConnection(catalog, current, {
            providerId: defaultProvider,
            authMode: defaultAuthMode
          })
        );
      }
      return catalog;
    } finally {
      setIsRefreshingModels(false);
    }
  };

  const refreshConnectionState = async (providerId: string, authMode: string) => {
    const payload = await readJson<{ connection: ProviderConnectionState }>(
      `/api/connection?providerId=${encodeURIComponent(providerId)}&authMode=${encodeURIComponent(authMode)}`
    );
    setDraftConnectionState(payload.connection);
    return payload.connection;
  };

  const refreshSavedConnectionState = async (providerId = savedSettings.providerId, authMode = savedSettings.authMode) => {
    const payload = await readJson<{ connection: ProviderConnectionState }>(
      `/api/connection?providerId=${encodeURIComponent(providerId)}&authMode=${encodeURIComponent(authMode)}`
    );
    setSavedConnectionState(payload.connection);
    return payload.connection;
  };

  const launchRun = (sessionId: string) => {
    setActiveRunSessionId(sessionId);
    setLiveMessages((current) => removeLiveMessagesForSession(current, sessionId));

    void readJson<RunRouteResponse>(`/api/sessions/${sessionId}/run`, {
      method: "POST"
    })
      .then(async (runResponse) => {
        await syncSessionState(sessionId);
        if (
          runResponse.run.status === "failed" &&
          runResponse.run.errorMessage &&
          runResponse.run.errorMessage !== RUN_STOPPED_BY_USER_MESSAGE
        ) {
          setError(runResponse.run.errorMessage);
        }
      })
      .catch(async (requestError) => {
        setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
        try {
          const payload = await refreshDetail(sessionId);
          await refreshSessions();
          if (!payload.run || payload.run.status !== "running") {
            setActiveRunSessionId((current) => (current === sessionId ? null : current));
          }
        } catch {
          setActiveRunSessionId((current) => (current === sessionId ? null : current));
        }
      });
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedLocale = window.localStorage.getItem(UI_LOCALE_STORAGE_KEY);
    setUiLocale(isUiLocale(storedLocale) ? storedLocale : getPreferredUiLocale());
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = uiLocale;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, uiLocale);
    }
  }, [uiLocale]);

  useEffect(() => {
    if (providerOptions.length === 0) {
      return;
    }

    setConnectionDraft((current) =>
      reconcileConnection(providerOptions, current, {
        providerId: defaultProvider,
        authMode: defaultAuthMode
      })
    );
  }, [defaultAuthMode, defaultProvider, providerOptions]);

  useEffect(() => {
    if (!connectionDraft.providerId || !connectionDraft.authMode) {
      setDraftConnectionState({
        providerId: connectionDraft.providerId,
        authModeId: connectionDraft.authMode,
        connected: false,
        available: false
      });
      return;
    }

    startTransition(() => {
      refreshConnectionState(connectionDraft.providerId, connectionDraft.authMode).catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
      });
    });
  }, [connectionDraft.authMode, connectionDraft.providerId, copy.errorFallback]);

  useEffect(() => {
    const nextModelId = sessionModelOptions.find((model) => model.id === form.model)?.id ?? sessionModelOptions[0]?.id ?? "";
    if (nextModelId === form.model) {
      return;
    }

    setForm((current) => ({
      ...current,
      model: nextModelId
    }));
  }, [form.model, sessionModelOptions]);

  useEffect(() => {
    if (thinkingOptions.some((option) => option.value === form.thinkingIntensity)) {
      return;
    }

    const nextThinkingIntensity = thinkingOptions[0]?.value;
    if (!nextThinkingIntensity) {
      return;
    }

    setForm((current) => ({
      ...current,
      thinkingIntensity: nextThinkingIntensity
    }));
  }, [form.thinkingIntensity, thinkingOptions]);

  useEffect(() => {
    startTransition(() => {
      refreshProviderCatalog().catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
      });
    });
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setLiveMessages({});
      return;
    }

    let active = true;
    startTransition(() => {
      refreshDetail(selectedId).catch((requestError) => {
        if (!active) {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
      });
    });

    return () => {
      active = false;
    };
  }, [selectedId, copy.errorFallback]);

  useEffect(() => {
    if (!selectedId || !isSelectedSessionRunning || typeof window === "undefined") {
      return;
    }

    const eventSource = new EventSource(`/api/sessions/${selectedId}/events`);

    const upsertLiveMessage = (
      messageId: string,
      updater: (current: LiveMessageRecord | undefined) => LiveMessageRecord
    ) => {
      setLiveMessages((current) => ({
        ...current,
        [messageId]: updater(current[messageId])
      }));
    };

    const handleStreamEvent = (streamEvent: MessageEvent<string>) => {
      const payload = JSON.parse(streamEvent.data) as RunStreamEvent;

      if (detail?.run?.id && payload.runId !== detail.run.id && payload.type !== "run-complete" && payload.type !== "run-error") {
        return;
      }

      if (payload.type === "text-delta") {
        upsertLiveMessage(payload.messageId, (current) => ({
          id: payload.messageId,
          sessionId: payload.sessionId,
          runId: payload.runId,
          roundId: payload.roundId,
          stage: payload.stage,
          agentKey: payload.agentKey,
          agentName: payload.agentName,
          role: payload.role,
          kind: payload.kind,
          content: payload.snapshot,
          reasoning: current?.reasoning ?? "",
          createdAt: payload.createdAt,
          status: current?.status ?? "streaming"
        }));
        return;
      }

      if (payload.type === "reasoning-delta") {
        upsertLiveMessage(payload.messageId, (current) => ({
          id: payload.messageId,
          sessionId: payload.sessionId,
          runId: payload.runId,
          roundId: payload.roundId,
          stage: payload.stage,
          agentKey: payload.agentKey,
          agentName: payload.agentName,
          role: payload.role,
          kind: payload.kind,
          content: current?.content ?? "",
          reasoning: payload.snapshot,
          createdAt: payload.createdAt,
          status: current?.status ?? "streaming"
        }));
        return;
      }

      if (payload.type === "message-complete") {
        upsertLiveMessage(payload.messageId, () => ({
          id: payload.messageId,
          sessionId: payload.sessionId,
          runId: payload.runId,
          roundId: payload.roundId,
          stage: payload.stage,
          agentKey: payload.agentKey,
          agentName: payload.agentName,
          role: payload.role,
          kind: payload.kind,
          content: payload.content,
          reasoning: payload.reasoning,
          createdAt: payload.createdAt,
          status: "complete"
        }));
        return;
      }

      if (payload.type === "run-complete" || payload.type === "run-error") {
        setLiveMessages((current) => filterLiveMessagesForSessionRun(current, selectedId, payload.runId));
        void syncSessionState(selectedId).catch(() => undefined);
        eventSource.close();
      }
    };

    eventSource.addEventListener("text-delta", handleStreamEvent as EventListener);
    eventSource.addEventListener("reasoning-delta", handleStreamEvent as EventListener);
    eventSource.addEventListener("message-complete", handleStreamEvent as EventListener);
    eventSource.addEventListener("run-complete", handleStreamEvent as EventListener);
    eventSource.addEventListener("run-error", handleStreamEvent as EventListener);
    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [selectedId, isSelectedSessionRunning, detail?.run?.id]);

  useEffect(() => {
    if (!selectedId || (!isSelectedSessionRunning && detail?.run?.status !== "running")) {
      return;
    }

    let active = true;
    const poll = async () => {
      try {
        const payload = await syncSessionState(selectedId);
        if (!active) {
          return;
        }

        if (payload.run?.status !== "running") {
          setActiveRunSessionId((current) => (current === selectedId ? null : current));
        }
      } catch (requestError) {
        if (!active) {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedId, isSelectedSessionRunning, detail?.run?.status, copy.errorFallback]);

  const handleSaveConnection = async () => {
    setError(null);
    setIsSavingConnection(true);

    try {
      const payload = reconcileConnection(providerOptions, connectionDraft, {
        providerId: defaultProvider,
        authMode: defaultAuthMode
      });
      const saved = await readJson<{ settings: AppSettings; connection: ProviderConnectionState }>("/api/connection", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setSavedSettings(saved.settings);
      setSavedConnectionState(saved.connection);
      setDraftConnectionState(saved.connection);
      setConnectionDraft({
        providerId: saved.settings.providerId,
        authMode: saved.settings.authMode,
        apiKey: ""
      });
      await refreshProviderCatalog();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
    } finally {
      setIsSavingConnection(false);
    }
  };

  const handleOpenLogin = async () => {
    if (!connectionProvider || !connectionAuthOption || connectionAuthOption.type !== "oauth") {
      setError(copy.connection.authDescriptionFallback);
      return;
    }

    setError(null);
    const popup = window.open("", "opencode-provider-login", "popup=yes,width=720,height=840");
    if (!popup) {
      setError(copy.errorFallback);
      return;
    }

    try {
      const pendingProviderId = connectionProvider.id;
      const pendingAuthModeId = connectionAuthOption.id;

      const flow = await beginProviderOauthFlow({
        providerId: pendingProviderId,
        authModeId: pendingAuthModeId,
        startOauth: async (providerId, authModeId) => {
          const response = await readJson<{
            settings: AppSettings;
            authModeId: string;
            url: string;
            method: "auto" | "code";
            instructions: string;
          }>(`/api/auth/accounts/${providerId}/start`, {
            method: "POST",
            body: JSON.stringify({ authModeId })
          });

          setSavedSettings(response.settings);
          const nextSavedConnection = await refreshSavedConnectionState(response.settings.providerId, response.settings.authMode);
          setDraftConnectionState(nextSavedConnection);
          return response;
        },
        waitForCompletion: async () =>
          waitForOauthAutoCompletion({
            isConnected: async () => {
              await refreshProviderCatalog();
              const connection = await refreshConnectionState(pendingProviderId, pendingAuthModeId);
              return connection.connected;
            },
            pollIntervalMs: 2_000,
            timeoutMs: 180_000
          })
      });

      setPendingOauth(flow.pendingOauth);
      oauthPopupRef.current = popup;
      popup.location.href = flow.pendingOauth.authorizationUrl;

      void flow.completion?.then(async () => {
        await refreshProviderCatalog();
        const nextConnection = await refreshConnectionState(flow.pendingOauth.providerId, flow.pendingOauth.authModeId);
        setSavedConnectionState(nextConnection);
        oauthPopupRef.current?.close();
        oauthPopupRef.current = null;
        setPendingOauth((current) =>
          current?.providerId === flow.pendingOauth.providerId && current.authModeId === flow.pendingOauth.authModeId ? null : current
        );
        setError(null);
      }).catch((requestError) => {
        void refreshSavedConnectionState(flow.pendingOauth.providerId, flow.pendingOauth.authModeId).catch(() => undefined);
        oauthPopupRef.current?.close();
        oauthPopupRef.current = null;
        setPendingOauth((current) =>
          current?.providerId === flow.pendingOauth.providerId && current.authModeId === flow.pendingOauth.authModeId ? null : current
        );
        setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
      });
    } catch (requestError) {
      popup.close();
      setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
    }
  };

  const handleCompleteOauth = async () => {
    if (!pendingOauth || pendingOauth.method !== "code") {
      return;
    }

    setError(null);
    setPendingOauth((current) => (current ? { ...current, isSubmitting: true } : current));

    try {
      await readJson(`/api/auth/accounts/${pendingOauth.providerId}/callback`, {
        method: "POST",
        body: JSON.stringify({
          authModeId: pendingOauth.authModeId,
          code: pendingOauth.code
        })
      });
      await refreshProviderCatalog();
      const nextConnection = await refreshConnectionState(pendingOauth.providerId, pendingOauth.authModeId);
      setSavedConnectionState(nextConnection);
      oauthPopupRef.current?.close();
      oauthPopupRef.current = null;
      setPendingOauth(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
      setPendingOauth((current) => (current ? { ...current, isSubmitting: false } : current));
    }
  };

  const handleDisconnectAuth = async () => {
    if (!connectionProvider) {
      return;
    }

    setError(null);
    try {
      await readJson(`/api/auth/accounts/${connectionProvider.id}`, { method: "DELETE" });
      oauthPopupRef.current?.close();
      oauthPopupRef.current = null;
      setPendingOauth(null);
      await refreshProviderCatalog();
      const nextConnection = await refreshConnectionState(connectionDraft.providerId, connectionDraft.authMode);
      setSavedConnectionState(nextConnection);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
    }
  };

  const handleGeneratePreset = async () => {
    if (isConnectionDirty) {
      setError(copy.session.dirtyHint);
      return;
    }
    if (!savedSettings.providerId || !form.model) {
      setError(getSessionModelHint(uiLocale));
      return;
    }
    if (!savedConnectionState.connected) {
      setError(copy.session.connectHint);
      return;
    }

    setIsGeneratingPreset(true);
    setError(null);

    try {
      const response = await readJson<GeneratedPresetResponse>("/api/presets/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt: generatedPresetPrompt,
          agentCount: generatedPresetAgentCount,
          language: form.language,
          provider: savedSettings.providerId,
          model: form.model
        })
      });

      setGeneratedPreset(response.preset);
      setForm((current) => ({ ...current, presetId: response.preset.id }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
    } finally {
      setIsGeneratingPreset(false);
    }
  };

  const handleCreate = async () => {
    if (isConnectionDirty) {
      setError(copy.session.dirtyHint);
      return;
    }
    if (!savedSettings.providerId || !form.model) {
      setError(getSessionModelHint(uiLocale));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await readJson<{ sessionId: string }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          customPreset: generatedPreset?.id === form.presetId ? generatedPreset : undefined,
          provider: savedSettings.providerId,
          model: form.model
        })
      });

      setIsCreateSessionOpen(false);
      setSelectedId(created.sessionId);
      launchRun(created.sessionId);
      await refreshSessions().catch(() => undefined);
      await refreshDetail(created.sessionId).catch(() => undefined);
      setForm((current) => ({
        ...current,
        title: "",
        prompt: "",
        presetId: initialPresets[0]?.id ?? "saas-founder"
      }));
      setGeneratedPreset(null);
      setGeneratedPresetPrompt("");
      setGeneratedPresetAgentCount(CUSTOM_PRESET_AGENT_COUNT_DEFAULT);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRerun = async () => {
    if (!selectedId) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      launchRun(selectedId);
      await refreshSessions().catch(() => undefined);
      await refreshDetail(selectedId).catch(() => undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStop = async () => {
    if (!selectedId || !isSelectedSessionRunning) {
      return;
    }

    setError(null);
    setIsStoppingRun(true);

    try {
      await readJson<RunRouteResponse>(`/api/sessions/${selectedId}/run`, {
        method: "DELETE"
      });
      setActiveRunSessionId((current) => (current === selectedId ? null : current));
      await syncSessionState(selectedId).catch(() => undefined);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
    } finally {
      setIsStoppingRun(false);
    }
  };

  const selectedSessionSummary = useMemo(
    () => sessions.find((entry) => entry.session.id === selectedId) ?? null,
    [selectedId, sessions]
  );
  const selectedRunId = detail?.run?.id ?? selectedSessionSummary?.run?.id ?? null;
  const activePreset = useMemo(
    () =>
      detail?.session.customPreset ??
      selectedSessionSummary?.session.customPreset ??
      availablePresets.find(
        (preset) => preset.id === (detail?.session.presetId ?? selectedSessionSummary?.session.presetId ?? form.presetId)
      ) ??
      selectedPreset,
    [
      availablePresets,
      detail?.session.customPreset,
      detail?.session.presetId,
      form.presetId,
      selectedPreset,
      selectedSessionSummary?.session.customPreset,
      selectedSessionSummary?.session.presetId
    ]
  );

  useEffect(() => {
    if (generatedPreset || availablePresets.some((preset) => preset.id === form.presetId)) {
      return;
    }

    setForm((current) => ({
      ...current,
      presetId: initialPresets[0]?.id ?? "saas-founder"
    }));
  }, [availablePresets, form.presetId, generatedPreset, initialPresets]);
  const timelineTitle = detail?.session.title ?? selectedSessionSummary?.session.title ?? copy.detail.emptyTitle;
  const timelinePrompt = detail?.session.prompt ?? selectedSessionSummary?.session.prompt ?? copy.detail.emptyDescription;
  const debateVisualization = useMemo(
    () =>
      detail
        ? buildDebateVisualization({
          detail,
          panel: activePreset,
          isRunning: isSelectedSessionRunning,
          liveMessages: Object.values(liveMessages).filter(
            (message) => message.sessionId === detail.session.id && message.runId === selectedRunId
          )
        })
        : null,
    [activePreset, detail, isSelectedSessionRunning, liveMessages]
  );
  const latestFeedMessage = useMemo(
    () => debateVisualization?.activityFeed.find((entry) => entry.type === "message") ?? null,
    [debateVisualization]
  );
  const liveTimelineMessage =
    isSelectedSessionRunning && debateVisualization
      ? getWaitingFeedLabel(uiLocale, debateVisualization.summary.activeStage)
      : null;

  useEffect(() => {
    if (!isSelectedSessionRunning) {
      return;
    }

    timelineEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [
    isSelectedSessionRunning,
    detail?.rounds.length,
    detail?.rounds[detail?.rounds.length ? detail.rounds.length - 1 : 0]?.messages.length
  ]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#060913] text-gray-100 font-sans selection:bg-blue-500/30">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-800 bg-[#090d1a] px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-[0_4px_10px_rgba(37,99,235,0.35)]">
            <Lightbulb className="text-white" size={16} />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-gray-100">Ship Council</h1>
            <span className="flex h-5 items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2 text-[10px] font-bold text-blue-400">
              MVP
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{copy.uiLanguageLabel}</span>
            <div className="relative w-28">
              <Select
                className="h-8 w-full appearance-none rounded-lg border-gray-700 bg-gray-800/90 pl-3 pr-8 text-xs text-gray-200"
                value={uiLocale}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => setUiLocale(event.target.value as UiLocale)}
              >
                {UI_LOCALE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </div>
          <div className="h-5 w-px bg-gray-800" />
          <Button variant="ghost" size="sm" className="h-8 rounded-lg border border-gray-700 bg-gray-800/80 px-3 text-xs text-gray-300 hover:bg-gray-700 hover:text-white" onClick={() => setIsSettingsOpen(true)}>
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            {copy.connection.title}
          </Button>
        </div>
      </header>

      {error ? (
        <div className="flex items-start gap-3 border-b border-red-500/30 bg-red-500/10 px-6 py-3 text-sm text-red-100">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-red-300" />
          <span>{error}</span>
        </div>
      ) : null}

      <main className="flex flex-1 min-h-0">
        <aside className="council-scrollbar flex w-[340px] shrink-0 flex-col overflow-y-auto border-r border-gray-800 bg-[#090d1a]/50">
          <div className="flex flex-col">
            <div className="p-6 pb-2 border-b border-gray-800 bg-[#060913] sticky top-0 z-10 w-full mb-2">
              <Button
                className="w-full justify-start h-11 bg-blue-600 text-white hover:bg-blue-500 rounded-xl shadow-[0_8px_20px_rgba(37,99,235,0.2)]"
                onClick={() => setIsCreateSessionOpen(true)}
              >
                <Lightbulb size={16} className="mr-2" />
                {copy.session.title} (새로운 추가)
              </Button>
            </div>

            <section className="px-6 py-6">
              <div className="mb-4">
                <h2 className="text-sm font-bold text-gray-200">{copy.sessions.title}</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">{copy.sessions.description}</p>
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
                      onClick={() => setSelectedId(entry.session.id)}
                      className={cn(
                        "w-full rounded-[20px] border px-4 py-4 text-left transition",
                        selectedId === entry.session.id
                          ? "border-blue-500/30 bg-blue-500/10"
                          : "border-gray-800 bg-gray-900/70 hover:bg-gray-800/80"
                      )}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <p className="line-clamp-1 text-sm font-semibold text-gray-100">{entry.session.title}</p>
                        <Badge
                          className={cn(
                            "border px-2.5 py-1 text-[10px]",
                            sessionRunning
                              ? "border-blue-500/20 bg-blue-500/10 text-blue-300"
                              : "border-gray-700 bg-gray-800 text-gray-400"
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
                      <div className="mb-2 flex flex-wrap gap-2">
                        <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">{entry.session.provider}</Badge>
                        <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">{entry.session.model}</Badge>
                        <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">
                          {getUiLanguageLabel(entry.session.language, uiLocale)}
                        </Badge>
                        <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">
                          {getDebateIntensityLabel(entry.session.debateIntensity, uiLocale)}
                        </Badge>
                        <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">
                          {getThinkingIntensityLabel(entry.session.thinkingIntensity, uiLocale)}
                        </Badge>
                      </div>
                      <p className="line-clamp-2 text-xs leading-5 text-gray-500">{entry.session.prompt}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[#060913] relative">
          <div className="border-b border-gray-800 bg-gray-950/92 px-6 py-5 backdrop-blur">
            <h2 className="truncate text-xl font-bold text-gray-100">{timelineTitle || copy.detail.emptyTitle}</h2>
            <p className="mt-1 truncate text-sm text-gray-400">{timelinePrompt}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge className="border-gray-700 bg-gray-900 text-gray-300">
                {detail?.session.provider ?? selectedSessionSummary?.session.provider ?? connectionProvider?.label ?? copy.noProvider}
              </Badge>
              <Badge className="border-gray-700 bg-gray-900 text-gray-300">
                {detail?.session.model ?? selectedSessionSummary?.session.model ?? sessionModel?.label ?? copy.noModel}
              </Badge>
              {detail?.session || selectedSessionSummary ? (
                <Badge className="border-gray-700 bg-gray-900 text-gray-300">
                  {getUiLanguageLabel(
                    (detail?.session.language ?? selectedSessionSummary?.session.language ?? "ko") as SessionLanguage,
                    uiLocale
                  )}
                </Badge>
              ) : null}
              {detail?.session || selectedSessionSummary ? (
                <Badge className="border-gray-700 bg-gray-900 text-gray-300">
                  {getDebateIntensityLabel(
                    (detail?.session.debateIntensity ??
                      selectedSessionSummary?.session.debateIntensity ??
                      DEBATE_INTENSITY_DEFAULT) as number,
                    uiLocale
                  )}
                </Badge>
              ) : null}
              {detail?.session || selectedSessionSummary ? (
                <Badge className="border-gray-700 bg-gray-900 text-gray-300">
                  {getThinkingIntensityLabel(
                    (detail?.session.thinkingIntensity ??
                      selectedSessionSummary?.session.thinkingIntensity ??
                      "balanced") as ThinkingIntensity,
                    uiLocale
                  )}
                </Badge>
              ) : null}
              {isSelectedSessionRunning ? (
                <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-300">
                  <span className="inline-flex items-center gap-1">
                    <LoaderCircle className="h-3 w-3 animate-spin" />
                    {copy.detail.live}
                  </span>
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="council-scrollbar flex-1 overflow-y-auto px-6 py-6">
            {detail && debateVisualization ? (
              <div className="mb-6 space-y-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
                  <div className="rounded-[28px] border border-blue-500/15 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_rgba(8,15,28,0.92)_60%)] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-2xl">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-300/80">
                          {getLiveWorkspaceLabel(uiLocale)}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold text-white">{getLiveWorkspaceDescription(uiLocale, isSelectedSessionRunning)}</h3>
                      </div>
                      <Badge className="border-blue-400/20 bg-blue-500/10 text-blue-200">
                        {debateVisualization.summary.activeStage
                          ? getRoundStageLabel(debateVisualization.summary.activeStage, uiLocale)
                          : getStatusLabel(detail.run?.status ?? detail.session.status, uiLocale)}
                      </Badge>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                      <div className="rounded-[20px] border border-white/8 bg-black/10 px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">
                          {getProgressMetricLabel("expected", uiLocale)}
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-white">{debateVisualization.summary.expectedRounds}</p>
                      </div>
                      <div className="rounded-[20px] border border-white/8 bg-black/10 px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">
                          {getProgressMetricLabel("completed", uiLocale)}
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-white">{debateVisualization.summary.completedRounds}</p>
                      </div>
                      <div className="rounded-[20px] border border-white/8 bg-black/10 px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">
                          {getProgressMetricLabel("stage", uiLocale)}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {debateVisualization.summary.activeStage
                            ? getRoundStageLabel(debateVisualization.summary.activeStage, uiLocale)
                            : getStatusLabel(detail.run?.status ?? detail.session.status, uiLocale)}
                        </p>
                      </div>
                      <div className="rounded-[20px] border border-white/8 bg-black/10 px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">
                          {getProgressMetricLabel("speaker", uiLocale)}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {latestFeedMessage ? latestFeedMessage.agentName : getWaitingFeedLabel(uiLocale, debateVisualization.summary.activeStage)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                          {getScrumBoardLabel(uiLocale)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {debateVisualization.summary.messageCount} / {getContributionLabel(debateVisualization.summary.messageCount, uiLocale)}
                        </p>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-4">
                        {debateVisualization.stages.map((stage) => {
                          const completionRatio = Math.min(100, stage.progressRatio * 100);

                          return (
                            <div
                              key={stage.key}
                              className={cn(
                                "rounded-[22px] border px-4 py-4 transition",
                                stage.status === "active"
                                  ? "border-blue-400/35 bg-blue-500/10 shadow-[0_16px_40px_rgba(37,99,235,0.18)]"
                                  : stage.status === "completed"
                                    ? "border-emerald-400/20 bg-emerald-500/8"
                                    : "border-gray-800 bg-gray-950/50"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-gray-100">{getRoundStageLabel(stage.key, uiLocale)}</p>
                                  <p className="mt-1 text-xs text-gray-500">{getStageStatusLabel(stage.status, uiLocale)}</p>
                                </div>
                                <Badge
                                  className={cn(
                                    "border px-2.5 py-1 text-[10px]",
                                    stage.status === "active"
                                      ? "border-blue-400/20 bg-blue-500/10 text-blue-200"
                                      : stage.status === "completed"
                                        ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                                        : "border-gray-700 bg-gray-900 text-gray-400"
                                  )}
                                >
                                  {stage.completedRounds}/{stage.expectedRounds}
                                </Badge>
                              </div>
                              <div className="mt-4 h-2 rounded-full bg-gray-900/80">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    stage.status === "active"
                                      ? "bg-blue-400"
                                      : stage.status === "completed"
                                        ? "bg-emerald-400"
                                        : "bg-gray-700"
                                  )}
                                  style={{ width: `${completionRatio}%` }}
                                />
                              </div>
                              <div className="mt-3 space-y-1 text-xs text-gray-400">
                                <p>{getSpeakerProgressLabel(stage.currentSpeakerCount, stage.totalSpeakerCount, uiLocale)}</p>
                                <p>
                                  {stage.currentRoundNumber
                                    ? `${copy.detail.round} ${stage.currentRoundNumber}`
                                    : getWaitingFeedLabel(uiLocale, stage.status === "pending" ? stage.key : null)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-gray-800 bg-gray-950/75 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                          {getActivityFeedLabel(uiLocale)}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold text-white">{copy.detail.live}</h3>
                      </div>
                      <Badge className="border-gray-700 bg-gray-900 text-gray-300">
                        {latestFeedMessage ? latestFeedMessage.kind : getStageStatusLabel("active", uiLocale)}
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-3">
                      {debateVisualization.activityFeed.map((entry, index) => (
                        <div
                          key={entry.type === "message" ? entry.id : `system-${entry.stage ?? "idle"}-${index}`}
                          className="rounded-[20px] border border-gray-800 bg-gray-900/80 px-4 py-4"
                        >
                          {entry.type === "message" ? (
                            <>
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-gray-100">{entry.agentName}</p>
                                <Badge className={cn(
                                  "border-gray-700 bg-gray-800 text-gray-300",
                                  entry.isStreaming && "border-blue-400/20 bg-blue-500/10 text-blue-200"
                                )}>
                                  {entry.isStreaming ? `${getRoundStageLabel(entry.stage, uiLocale)} · Live` : getRoundStageLabel(entry.stage, uiLocale)}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-gray-300 line-clamp-3">{entry.label}</p>
                              <p className="mt-2 text-xs text-gray-500">{getMessageKindLabel(entry.kind, uiLocale)}</p>
                            </>
                          ) : (
                            <p className="text-sm leading-6 text-gray-400">
                              {getWaitingFeedLabel(uiLocale, entry.stage)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-gray-800 bg-gray-950/75 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                        {getAgentBoardLabel(uiLocale)}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-white">{activePreset?.name ?? timelineTitle}</h3>
                    </div>
                    <Badge className="border-gray-700 bg-gray-900 text-gray-300">
                      {getContributionLabel(debateVisualization.summary.messageCount, uiLocale)}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {debateVisualization.agents.map((agent) => {
                      const visual = getAgentVisual(agent.agentKey, agent.role);
                      const Icon = visual.icon;

                      return (
                        <div key={agent.agentKey} className="rounded-[22px] border border-gray-800 bg-gray-900/80 px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", visual.bg, visual.border)}>
                                <Icon size={18} className={visual.color} />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-100">{agent.agentName}</p>
                                <p className="truncate text-xs text-gray-500">{agent.role}</p>
                              </div>
                            </div>
                            <Badge
                              className={cn(
                                "border px-2.5 py-1 text-[10px]",
                                agent.status === "active"
                                  ? "border-blue-400/20 bg-blue-500/10 text-blue-200"
                                  : agent.status === "done"
                                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                                    : "border-gray-700 bg-gray-900 text-gray-400"
                              )}
                            >
                              {getAgentStatusLabel(agent.status, uiLocale)}
                            </Badge>
                          </div>
                          <p className="mt-4 text-sm text-gray-300">{getContributionLabel(agent.contributionCount, uiLocale)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {!detail ? (
              <div className="flex min-h-[560px] flex-col items-center justify-center rounded-[28px] border border-dashed border-gray-800 bg-gray-900/30 px-6 text-center">
                <Users size={34} className="mb-4 text-gray-700" />
                <p className="text-sm font-medium text-gray-300">{copy.detail.emptyTitle}</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">{copy.detail.emptyDescription}</p>
              </div>
            ) : null}

            <div className="space-y-8">
              {debateVisualization?.timeline.map((round) => (
                <div key={round.id} className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-gray-800" />
                    <div className="flex items-center gap-2 rounded-full border border-gray-800 bg-gray-900 px-4 py-1.5">
                      <Badge className="border-gray-700 bg-gray-800 text-gray-300">
                        {copy.detail.round} {round.roundNumber}
                      </Badge>
                      <span className="text-xs font-semibold tracking-[0.14em] text-gray-400">
                        {getRoundStageLabel(round.stage, uiLocale)}
                      </span>
                    </div>
                    <div className="h-px flex-1 bg-gray-800" />
                  </div>

                  {round.summary ? (
                    <div className="rounded-[22px] border border-gray-800 bg-gray-900/60 px-5 py-4">
                      <p className="text-sm leading-6 text-gray-400">{round.summary}</p>
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    {round.messages.map((message, messageIndex) => {
                      const agentRole =
                        activePreset?.agents.find((agent) => agent.key === message.agentKey)?.role ?? message.role;
                      const visual = getAgentVisual(message.agentKey, agentRole);
                      const Icon = visual.icon;

                      return (
                        <div key={message.id} className="flex gap-4">
                          <div className="flex shrink-0 flex-col items-center">
                            <div
                              className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-xl border shadow-[0_6px_18px_rgba(0,0,0,0.2)]",
                                visual.bg,
                                visual.border
                              )}
                            >
                              <Icon size={18} className={visual.color} />
                            </div>
                            {messageIndex !== round.messages.length - 1 ? <div className="mt-2 h-full w-px bg-gray-800" /> : null}
                          </div>

                          <div className="min-w-0 flex-1 mb-4 border-b pb-5 border-gray-800 bg-gray-900/80 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/80 pb-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-100">{message.agentName}</p>
                                <p className="truncate text-xs text-gray-500">{agentRole}</p>
                              </div>
                              <Badge className={cn(
                                "border-gray-700 bg-gray-800 text-gray-300",
                                message.isStreaming && "border-blue-400/20 bg-blue-500/10 text-blue-200"
                              )}>
                                {message.isStreaming ? `${getMessageKindLabel(message.kind, uiLocale)} · Live` : getMessageKindLabel(message.kind, uiLocale)}
                              </Badge>
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-7 text-gray-300">{message.content}</p>
                            {message.reasoning ? (
                              <div className="mt-4 rounded-2xl border border-blue-500/15 bg-blue-500/5 px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300/80">Thinking</p>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-blue-100/80">{message.reasoning}</p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {liveTimelineMessage ? (
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-800 bg-gray-900">
                    <LoaderCircle className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                  <div className="flex-1 rounded-[22px] border border-gray-800 bg-gray-900/70 px-5 py-4">
                    <p className="text-sm text-gray-400">{liveTimelineMessage}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div ref={timelineEndRef} />
          </div>
        </section>

        <aside className="flex w-[430px] shrink-0 flex-col overflow-y-auto border-l border-gray-800 bg-[#090d1a]/50">
          <div className="border-b border-gray-800 px-6 py-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-100">
              <CheckCircle2 size={20} className="text-emerald-400" />
              {copy.decision.title}
            </h2>
            <p className="mt-1 text-sm text-gray-400">{getDecisionSectionDescription(uiLocale)}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="h-10 rounded-xl border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700"
                onClick={handleRerun}
                disabled={!selectedId || isSubmitting || isStoppingRun || isSelectedSessionRunning}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                {copy.decision.rerun}
              </Button>
              {isSelectedSessionRunning ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-10 rounded-xl border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/20"
                  onClick={handleStop}
                  disabled={!selectedId || isStoppingRun}
                >
                  {isStoppingRun ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                  {copy.decision.stop}
                </Button>
              ) : null}
              {selectedId ? (
                <>
                  <a href={`/api/sessions/${selectedId}/export?format=md`} target="_blank" rel="noreferrer">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 rounded-xl border border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {copy.decision.markdown}
                    </Button>
                  </a>
                  <a href={`/api/sessions/${selectedId}/export?format=json`} target="_blank" rel="noreferrer">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 rounded-xl border border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {copy.decision.json}
                    </Button>
                  </a>
                </>
              ) : null}
            </div>
          </div>

          <div className="council-scrollbar flex-1 px-6 py-6 overflow-y-auto">
            {!detail?.decision ? (
              <div className="flex min-h-[560px] flex-col items-center justify-center rounded-[28px] border border-dashed border-gray-800 bg-gray-950/50 px-6 text-center">
                <Info size={32} className="mb-4 text-gray-700" />
                <p className="max-w-md text-sm leading-6 text-gray-500">{copy.decision.empty}</p>
              </div>
            ) : null}

            {detail?.decision ? (
              <div className="flex flex-col">
                <section className="mb-4 border-b pb-5 border-emerald-500/20 bg-emerald-500/8 px-5 py-5">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-400">
                    <CheckCircle2 size={16} />
                    {copy.decision.topRecommendation}
                  </h3>
                  <p className="text-sm leading-7 text-emerald-50">{detail.decision.topRecommendation}</p>
                </section>

                <section className="mb-4 border-b pb-5 border-gray-800 bg-gray-950/90 px-5 py-5">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-300">
                    <Hexagon size={16} />
                    {copy.decision.finalSummary}
                  </h3>
                  <p className="text-sm leading-7 text-gray-400">{detail.decision.finalSummary}</p>
                </section>

                {detail.decision.risks.length > 0 ? (
                  <section className="mb-4 border-b pb-5 border-red-500/15 bg-red-500/6 px-5 py-5">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-red-400">
                      <AlertTriangle size={16} />
                      {getRiskSectionLabel(uiLocale)}
                    </h3>
                    <ul className="space-y-3">
                      {detail.decision.risks.map((risk) => (
                        <li key={risk} className="flex items-start gap-2 text-sm leading-6 text-gray-300">
                          <span className="mt-1 text-xs text-red-400">&bull;</span>
                          <span>{risk}</span>
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
                    })} / {copy.decision.updated}:{" "}
                    {formatUiTimestamp(detail.run.completedAt ?? detail.run.updatedAt, uiLocale)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="flex flex-col w-full max-w-lg max-h-[90vh] rounded-[24px] border border-gray-800 bg-[#060913] shadow-[0_24px_50px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 bg-[#090d1a]">
              <h2 className="text-lg font-bold text-gray-100">{copy.connection.title}</h2>
              <button className="text-gray-400 hover:text-white" onClick={() => setIsSettingsOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="council-scrollbar flex-1 overflow-y-auto p-6">
              <div>
                <div className="mb-5">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-gray-200">
                    <Wifi size={16} className="text-gray-400" />
                    {copy.connection.title}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-gray-500">{getConnectionSectionDescription(uiLocale)}</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                      {copy.connection.provider}
                    </label>
                    <div className="relative">
                      <Select
                        className="h-12 appearance-none rounded-[18px] border-gray-800 bg-gray-900/80 px-4 pr-10 text-sm text-gray-100"
                        value={connectionDraft.providerId}
                        disabled={!hasProviders}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                          const nextProvider =
                            providerOptions.find((provider) => provider.id === event.target.value) ?? providerOptions[0];
                          setConnectionDraft((current) =>
                            reconcileConnection(
                              providerOptions,
                              {
                                ...current,
                                providerId: event.target.value,
                                authMode:
                                  nextProvider
                                    ? pickPreferredAuthModeId(nextProvider.authModes, current.authMode)
                                    : current.authMode,
                                apiKey: ""
                              },
                              { providerId: defaultProvider, authMode: defaultAuthMode }
                            )
                          );
                        }}
                      >
                        {providerOptions.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.label}
                          </option>
                        ))}
                      </Select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                      {copy.connection.loginMethod}
                    </label>
                    <div className="relative">
                      <Select
                        className="h-12 appearance-none rounded-[18px] border-gray-800 bg-gray-900/80 px-4 pr-10 text-sm text-gray-100"
                        value={connectionDraft.authMode}
                        disabled={!connectionProvider}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          setConnectionDraft((current) => ({ ...current, authMode: event.target.value, apiKey: "" }))
                        }
                      >
                        {(connectionProvider?.authModes ?? []).map((authOption) => (
                          <option key={authOption.id} value={authOption.id}>
                            {authOption.label}
                          </option>
                        ))}
                      </Select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                    <p className="text-xs leading-5 text-gray-500">
                      {connectionAuthOption?.description ?? copy.connection.authDescriptionFallback}
                    </p>
                  </div>

                  <div className="rounded-[20px] border border-gray-800 bg-gray-900/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-gray-400">{copy.connection.status}</span>
                      <Badge
                        className={cn(
                          "border px-2.5 py-1 text-[10px]",
                          isProviderConnected
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "border-gray-700 bg-gray-800 text-gray-400"
                        )}
                      >
                        {isProviderConnected ? copy.connection.connected : copy.connection.notConnected}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      {isProviderConnected ? copy.connection.connectedDescription : copy.connection.notConnectedDescription}
                    </p>
                  </div>

                  {connectionAuthOption?.type === "api" ? (
                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                        {connectionAuthOption.inputLabel ?? copy.connection.apiKey}
                      </label>
                      <Input
                        type="password"
                        className="h-12 rounded-[18px] border-gray-800 bg-gray-900/80 text-sm text-gray-100 placeholder:text-gray-500"
                        value={connectionDraft.apiKey}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setConnectionDraft((current) => ({ ...current, apiKey: event.target.value }))
                        }
                        placeholder={connectionAuthOption.inputPlaceholder ?? copy.connection.apiPlaceholder}
                      />
                      <p className="text-xs leading-5 text-gray-500">{copy.connection.apiHelp}</p>
                    </div>
                  ) : null}

                  {connectionAuthOption?.type === "oauth" ? (
                    <div className="rounded-[20px] border border-gray-800 bg-gray-900/70 p-4">
                      <div className="flex flex-wrap gap-2">
                        {isProviderConnected ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-10 rounded-xl border border-gray-700 bg-gray-800 px-4 text-gray-200 hover:bg-gray-700"
                            onClick={handleDisconnectAuth}
                          >
                            {copy.connection.disconnect}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            className="h-10 rounded-xl bg-blue-600 px-4 text-white hover:bg-blue-500"
                            onClick={handleOpenLogin}
                          >
                            <LogIn className="mr-2 h-4 w-4" />
                            {copy.connection.openLogin}
                          </Button>
                        )}
                      </div>
                      <p className="mt-3 text-xs leading-5 text-gray-500">
                        {isProviderConnected ? copy.connection.oauthConnectedDescription : copy.connection.oauthStartDescription}
                      </p>
                    </div>
                  ) : null}

                  {pendingOauth ? (
                    <div className="rounded-[20px] border border-orange-500/20 bg-orange-500/8 p-4">
                      <p className="text-sm font-medium text-gray-100">{copy.connection.oauthProgress}</p>
                      <p className="mt-2 text-xs leading-5 text-gray-400">{pendingOauth.instructions}</p>
                      {pendingOauth.method === "code" ? (
                        <div className="mt-3 space-y-3">
                          <Input
                            className="h-12 rounded-[18px] border-orange-500/20 bg-gray-900/80 text-sm text-gray-100"
                            value={pendingOauth.code}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              setPendingOauth((current) => (current ? { ...current, code: event.target.value } : current))
                            }
                            placeholder={copy.connection.oauthCodePlaceholder}
                          />
                          <Button
                            type="button"
                            className="h-11 w-full rounded-xl bg-blue-600 text-white hover:bg-blue-500"
                            onClick={handleCompleteOauth}
                            disabled={pendingOauth.isSubmitting || pendingOauth.code.trim().length === 0}
                          >
                            {pendingOauth.isSubmitting ? (
                              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <LogIn className="mr-2 h-4 w-4" />
                            )}
                            {copy.connection.oauthComplete}
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs leading-5 text-gray-400">{copy.connection.oauthAutoDescription}</p>
                          <p className="text-xs leading-5 text-gray-500">{copy.connection.oauthFallbackHint}</p>
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="space-y-2 pt-1">
                    <Button
                      className="h-11 w-full rounded-xl border border-gray-700 bg-gray-800 text-gray-100 hover:bg-gray-700"
                      onClick={handleSaveConnection}
                      disabled={isSavingConnection || !connectionProvider}
                    >
                      {isSavingConnection ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {copy.connection.save}
                    </Button>
                    <p className="text-xs leading-5 text-gray-500">
                      {copy.connection.savedAt}: {formatUiTimestamp(savedSettings.updatedAt, uiLocale)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-800 bg-[#090d1a] px-6 py-4 flex justify-end">
              <Button variant="secondary" className="bg-gray-800 text-white hover:bg-gray-700" onClick={() => setIsSettingsOpen(false)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
      {isCreateSessionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-[24px] border border-gray-800 bg-[#060913] shadow-[0_24px_50px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 bg-[#090d1a]">
              <h2 className="text-lg font-bold text-gray-100">{copy.session.title}</h2>
              <button className="text-gray-400 hover:text-white" onClick={() => setIsCreateSessionOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="council-scrollbar flex-1 overflow-y-auto p-6">
              <div>
                <div className="mb-5">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-gray-200">
                    <Lightbulb size={16} className="text-blue-400" />
                    {copy.session.title}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-gray-500">{getSessionSectionDescription(uiLocale)}</p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[20px] border border-gray-800 bg-gray-900/70 p-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                      {copy.session.activeConnection}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">
                        {savedProvider?.label ?? copy.session.providerNotSaved}
                      </Badge>
                      <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">
                        {savedAuthOption?.label ?? copy.session.loginNotSaved}
                      </Badge>
                      <Badge
                        className={cn(
                          "border px-3 py-1 text-xs",
                          savedConnectionState.connected
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "border-gray-700 bg-gray-800 text-gray-400"
                        )}
                      >
                        {savedConnectionState.connected ? copy.connection.connected : copy.connection.notConnected}
                      </Badge>
                      <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">{selectedLanguage.label}</Badge>
                      <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">
                        {sessionModel?.label ?? copy.session.modelNotSaved}
                      </Badge>
                      <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">{selectedDebateIntensityLabel}</Badge>
                      <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">{selectedThinkingIntensityLabel}</Badge>
                    </div>
                    {!savedConnectionState.connected ? (
                      <p className="mt-3 text-xs leading-5 text-gray-500">{copy.session.connectHint}</p>
                    ) : null}
                    {isConnectionDirty ? (
                      <p className="mt-3 text-xs leading-5 text-gray-500">{copy.session.dirtyHint}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                      {copy.session.titleLabel}
                    </label>
                    <Input
                      className="h-12 rounded-[18px] border-gray-800 bg-gray-900/80 text-sm text-gray-100 placeholder:text-gray-500"
                      value={form.title}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setForm((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder={copy.session.titlePlaceholder}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                      {copy.session.topicLabel}
                    </label>
                    <Textarea
                      className="min-h-[112px] rounded-[20px] border-gray-800 bg-gray-900/80 text-sm text-gray-100 placeholder:text-gray-500"
                      value={form.prompt}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                        setForm((current) => ({ ...current, prompt: event.target.value }))
                      }
                      placeholder={copy.session.topicPlaceholder}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                      {copy.session.presetLabel}
                    </label>
                    <div className="relative">
                      <Select
                        className="h-12 appearance-none rounded-[18px] border-gray-800 bg-gray-900/80 px-4 pr-10 text-sm text-gray-100"
                        value={form.presetId}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          setForm((current) => ({ ...current, presetId: event.target.value }))
                        }
                      >
                        {availablePresets.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.name}
                          </option>
                        ))}
                      </Select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-gray-800 bg-gray-900/50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                          {copy.session.customPresetTitle}
                        </p>
                        <p className="mt-2 text-sm text-gray-300">{copy.session.customPresetDescription}</p>
                      </div>
                      <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">{generatedPresetAgentCount} agents</Badge>
                    </div>

                    <div className="mt-4 space-y-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                        {copy.session.customPresetPromptLabel}
                      </label>
                      <Textarea
                        className="min-h-[112px] rounded-[20px] border-gray-800 bg-gray-900/80 text-sm text-gray-100 placeholder:text-gray-500"
                        value={generatedPresetPrompt}
                        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setGeneratedPresetPrompt(event.target.value)}
                        placeholder={copy.session.customPresetPromptPlaceholder}
                      />
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                          {copy.session.customPresetAgentCountLabel}
                        </label>
                        <Input
                          type="number"
                          min={GENERATED_PRESET_AGENT_COUNT_MIN}
                          max={GENERATED_PRESET_AGENT_COUNT_MAX}
                          step={1}
                          className="h-12 rounded-[18px] border-gray-800 bg-gray-900/80 text-sm text-gray-100"
                          value={generatedPresetAgentCount}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            setGeneratedPresetAgentCount(clampAgentCount(Number(event.target.value)))
                          }
                        />
                      </div>

                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-12 w-full rounded-xl border border-gray-700 bg-gray-800 text-gray-100 hover:bg-gray-700"
                          onClick={handleGeneratePreset}
                          disabled={
                            isGeneratingPreset ||
                            generatedPresetPrompt.trim().length < 10 ||
                            !savedSettings.providerId ||
                            !form.model ||
                            !savedConnectionState.connected ||
                            isConnectionDirty
                          }
                        >
                          {isGeneratingPreset ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                          {copy.session.generatePreset}
                        </Button>
                      </div>
                    </div>

                    {generatedPreset ? (
                      <div className="mt-4 rounded-[18px] border border-blue-500/20 bg-blue-500/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{generatedPreset.name}</p>
                            <p className="mt-1 text-sm leading-6 text-gray-300">{generatedPreset.description}</p>
                          </div>
                          <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-200">{copy.session.generatedPresetBadge}</Badge>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {generatedPreset.agents.map((agent) => (
                            <div key={agent.key} className="rounded-[16px] border border-gray-800 bg-gray-950/60 px-4 py-3">
                              <p className="text-sm font-semibold text-gray-100">{agent.name}</p>
                              <p className="mt-1 text-xs text-gray-500">{agent.role}</p>
                              <p className="mt-3 text-xs leading-5 text-gray-400">{agent.goal}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                          {getSessionModelLabel(uiLocale)}
                        </label>
                        {isRefreshingModels ? <span className="text-[11px] text-gray-500">{copy.refreshing}</span> : null}
                      </div>
                      <div className="relative">
                        <Select
                          className="h-12 appearance-none rounded-[18px] border-gray-800 bg-gray-900/80 px-4 pr-10 text-sm text-gray-100"
                          value={form.model}
                          disabled={!sessionProvider || sessionModelOptions.length === 0}
                          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                            setForm((current) => ({ ...current, model: event.target.value }))
                          }
                        >
                          {sessionModelOptions.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.label}
                            </option>
                          ))}
                        </Select>
                        <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                      </div>
                      <p className="text-xs leading-5 text-gray-500">
                        {sessionModel?.description ?? getSessionModelHint(uiLocale)}
                      </p>
                      {sessionModel?.supportsStructuredOutput ? (
                        <p className="flex items-center gap-1 text-[11px] text-emerald-400">
                          <CheckCircle2 size={12} />
                          Structured output ready
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                        {copy.session.languageLabel}
                      </label>
                      <div className="relative">
                        <Select
                          className="h-12 appearance-none rounded-[18px] border-gray-800 bg-gray-900/80 px-4 pr-10 text-sm text-gray-100"
                          value={form.language}
                          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                            setForm((current) => ({ ...current, language: event.target.value as SessionLanguage }))
                          }
                        >
                          {sessionLanguageOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                        <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                      </div>
                      <p className="text-xs leading-5 text-gray-500">{selectedLanguage.description}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                        {copy.session.debateIntensityLabel}
                      </label>
                      <Input
                        type="number"
                        min={DEBATE_INTENSITY_MIN}
                        max={DEBATE_INTENSITY_MAX}
                        step={1}
                        className="h-12 rounded-[18px] border-gray-800 bg-gray-900/80 text-sm text-gray-100"
                        value={form.debateIntensity}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setForm((current) => ({
                            ...current,
                            debateIntensity: clampDebateIntensity(Number(event.target.value))
                          }))
                        }
                      />
                      <p className="text-xs leading-5 text-gray-500">
                        {copy.session.debateIntensityHint} {selectedDebateIntensityDescription}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                        {getThinkingFieldLabel(uiLocale)}
                      </label>
                      <div className="relative">
                        <Select
                          className="h-12 appearance-none rounded-[18px] border-gray-800 bg-gray-900/80 px-4 pr-10 text-sm text-gray-100"
                          value={form.thinkingIntensity}
                          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                            setForm((current) => ({
                              ...current,
                              thinkingIntensity: event.target.value
                            }))
                          }
                        >
                          {thinkingOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                        <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                      </div>
                      <p className="text-xs leading-5 text-gray-500">
                        {getThinkingFieldHint(uiLocale)} {selectedThinkingIntensityDescription}
                      </p>
                    </div>
                  </div>



                  <Button
                    className="h-12 w-full rounded-xl bg-blue-600 text-white shadow-[0_12px_30px_rgba(37,99,235,0.28)] hover:bg-blue-500"
                    onClick={handleCreate}
                    disabled={
                      isSubmitting ||
                      form.prompt.trim().length < 10 ||
                      !savedSettings.providerId ||
                      !form.model ||
                      !savedProvider?.connected ||
                      isConnectionDirty
                    }
                  >
                    {isSubmitting ? (
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Lightbulb className="mr-2 h-4 w-4" />
                    )}
                    {copy.session.create}
                  </Button>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-800 bg-[#090d1a] px-6 py-4 flex justify-end">
              <Button variant="secondary" className="bg-gray-800 text-white hover:bg-gray-700" onClick={() => setIsCreateSessionOpen(false)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

