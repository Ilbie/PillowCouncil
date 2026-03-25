"use client";

import {
  Activity,
  CheckCircle2,
  Settings,
  Settings2,
  X,
  ChevronDown,
  Cpu,
  Lightbulb,
  LoaderCircle,
  LogIn,
  Lock,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import type { ChangeEvent } from "react";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import {
  GENERATED_PRESET_AGENT_COUNT_DEFAULT,
} from "@ship-council/agents";
import type { ProviderConnectionState } from "@ship-council/providers";

import { getModelThinkingOptions } from "@ship-council/shared/types";
import type {
  AppSettings,
  LiveMessageRecord,
  PresetDefinition,
  ProviderOption,
  RunStreamEvent,
  SessionDetailResponse,
  SessionLanguage,
  SessionSummary,
  ThinkingIntensity
} from "@ship-council/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CouncilHeader } from "@/components/council/CouncilHeader";
import { CreateSessionModal } from "@/components/council/CreateSessionModal";
import { DecisionSidebar } from "@/components/council/DecisionSidebar";
import { LiveWorkspacePanel } from "@/components/council/LiveWorkspacePanel";
import { SettingsModal } from "@/components/council/SettingsModal";
import { SessionSidebar } from "@/components/council/SessionSidebar";
import {
  type UiLocale,
  UI_LOCALE_STORAGE_KEY,
  formatUiTimestamp,
  getDebateIntensityDescription,
  getDebateIntensityLabel,
  getMessageKindLabel,
  getPreferredUiLocale,
  getRoundStageLabel,
  getUiCopy,
  getUiLanguageLabel,
  isUiLocale
} from "@/lib/i18n";
import {
  beginProviderOauthFlow,
  pickPreferredAuthModeId,
  waitForOauthAutoCompletion
} from "@/lib/provider-auth";
import {
  buildAvailablePresets,
  clampAgentCount,
  clampDebateIntensity,
  deriveConnectionStateFromProviderOptions,
  filterLiveMessagesForSessionRun,
  isMatchingSessionRunEvent,
  getThinkingIntensityDescription,
  getThinkingIntensityLabel,
  getNextSelectedSessionIdAfterDelete,
  isGeneratedPresetSourceCurrent,
  mergeSessionPages,
  resolveCustomPresetForSessionCreate,
  isSameConnection,
  readJson,
  reconcileConnection,
  removeLiveMessagesForSession,
  shouldRefreshSavedConnectionStateOnMount,
  shouldRefreshDraftConnectionState,
  shouldRefreshProviderCatalogOnMount,
  type ConnectionDraft
} from "@/lib/council-app-helpers";
import { SESSION_HISTORY_PAGE_SIZE, type SessionHistoryListResponse } from "@/lib/council-app-types";
import {
  getCloseLabel,
  getOpenPresetStudioLabel,
  getPresetStudioShortcutDescription,
  getReturnToSessionLabel,
  getSessionModelHint,
  getSessionModelLabel,
  getSessionSectionDescription,
  getStructuredOutputReadyLabel,
  getThinkingFieldHint,
  getThinkingFieldLabel
} from "@/lib/council-app-labels";
import { getAgentVisual } from "@/lib/council-agent-visuals";
import type {
  GeneratedPresetResponse,
  GeneratedPresetInputs,
  LiveMessageMap,
  McpSettingsDraft,
  PendingOauthState,
  RunRouteResponse,
  SessionFormState,
  SettingsTab,
  SkillsSettingsDraft
} from "@/lib/council-app-types";
import { buildDebateVisualization } from "@/lib/council-visualization";
import { cn } from "@/lib/utils";

type CouncilAppProps = {
  initialPresets: PresetDefinition[];
  initialSessions: SessionSummary[];
  initialTotalSessionCount: number;
  initialSettings: AppSettings;
  initialConnection: ProviderConnectionState;
  providerOptions: ProviderOption[];
  defaultProvider: string;
  defaultModel: string;
  defaultAuthMode: string;
};

const POLL_INTERVAL_MS = 1_500;
const RUN_STOPPED_BY_USER_MESSAGE = "Run stopped by user.";
const SESSION_LANGUAGE_VALUES: SessionLanguage[] = ["ko", "en", "ja"];
const DEBATE_INTENSITY_MIN = 1;
const DEBATE_INTENSITY_MAX = 20;
const DEBATE_INTENSITY_DEFAULT = 2;
const CUSTOM_PRESET_AGENT_COUNT_DEFAULT = GENERATED_PRESET_AGENT_COUNT_DEFAULT;

export function CouncilApp({
  initialPresets,
  initialSessions,
  initialTotalSessionCount,
  initialSettings,
  initialConnection,
  providerOptions: initialProviderOptions,
  defaultProvider,
  defaultModel,
  defaultAuthMode
}: CouncilAppProps) {
  const timelineEndRef = useRef<HTMLDivElement | null>(null);
  const oauthPopupRef = useRef<Window | null>(null);
  const loadedSessionLimitRef = useRef(Math.max(initialSessions.length, SESSION_HISTORY_PAGE_SIZE));
  const [uiLocale, setUiLocale] = useState<UiLocale>("ko");
  const [sessions, setSessions] = useState(initialSessions);
  const [totalSessionCount, setTotalSessionCount] = useState(initialTotalSessionCount);
  const [providerOptions, setProviderOptions] = useState(initialProviderOptions);
  const [selectedId, setSelectedId] = useState<string | null>(initialSessions[0]?.session.id ?? null);
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [liveMessages, setLiveMessages] = useState<LiveMessageMap>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [isSavingMcpSettings, setIsSavingMcpSettings] = useState(false);
  const [isSavingSkillsSettings, setIsSavingSkillsSettings] = useState(false);
  const [isStoppingRun, setIsStoppingRun] = useState(false);
  const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [savedSettings, setSavedSettings] = useState<AppSettings>(initialSettings);
  const [mcpSettings, setMcpSettings] = useState<McpSettingsDraft>({
    enabled: initialSettings.enableMcp,
    servers: []
  });
  const [skillsSettings, setSkillsSettings] = useState<SkillsSettingsDraft>({
    enabled: initialSettings.enableSkills,
    managed: [],
    available: []
  });
  const [savedConnectionState, setSavedConnectionState] = useState<ProviderConnectionState>(initialConnection);
  const [draftConnectionState, setDraftConnectionState] = useState<ProviderConnectionState>(initialConnection);
  const [activeRunSessionId, setActiveRunSessionId] = useState<string | null>(
    initialSessions.find((entry) => entry.run?.status === "running")?.session.id ?? null
  );
  const [activeStreamRunId, setActiveStreamRunId] = useState<string | null>(
    initialSessions.find((entry) => entry.run?.status === "running")?.run?.id ?? null
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("connection");
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedAgentKey, setSelectedAgentKey] = useState<string | null>(null);
  const [pendingOauth, setPendingOauth] = useState<PendingOauthState | null>(null);
  const [isGeneratingPreset, setIsGeneratingPreset] = useState(false);
  const [generatedPresetPrompt, setGeneratedPresetPrompt] = useState("");
  const [generatedPresetAgentCount, setGeneratedPresetAgentCount] = useState(CUSTOM_PRESET_AGENT_COUNT_DEFAULT);
  const [generatedPreset, setGeneratedPreset] = useState<PresetDefinition | null>(null);
  const [generatedPresetSource, setGeneratedPresetSource] = useState<GeneratedPresetInputs | null>(null);
  const [shouldReturnToSession, setShouldReturnToSession] = useState(false);
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
    enableWebSearch: false,
    thinkingIntensity: "balanced",
    debateIntensity: DEBATE_INTENSITY_DEFAULT,
    language: "ko"
  });

  const copy = useMemo(() => getUiCopy(uiLocale), [uiLocale]);
  const availablePresets = useMemo(() => buildAvailablePresets(initialPresets, generatedPreset), [generatedPreset, initialPresets]);
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
  const isSettingsConnectionSaved = savedConnectionState.connected && !isConnectionDirty;
  const isPresetTabLocked = !isSettingsConnectionSaved;
  const selectedSessionSummary = useMemo(() => sessions.find((entry) => entry.session.id === selectedId) ?? null, [selectedId, sessions]);
  const selectedRunId = detail?.run?.id ?? selectedSessionSummary?.run?.id ?? null;
  const streamRunId = activeStreamRunId ?? selectedRunId;
  const isPresetGenerationSuccess = Boolean(
    generatedPresetSource &&
    generatedPreset &&
    isGeneratedPresetSourceCurrent({
      source: generatedPresetSource,
      current: {
        prompt: generatedPresetPrompt,
        agentCount: generatedPresetAgentCount,
        language: form.language,
        model: form.model,
        providerId: savedSettings.providerId
      }
    })
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

  const refreshSessions = async (options?: { limit?: number }) => {
    const limit = Math.max(options?.limit ?? loadedSessionLimitRef.current, SESSION_HISTORY_PAGE_SIZE);
    loadedSessionLimitRef.current = limit;
    const payload = await readJson<SessionHistoryListResponse>(`/api/sessions?limit=${limit}&offset=0`);
    setSessions(payload.items);
    setTotalSessionCount(payload.totalCount);
    if (!selectedId && payload.items[0]) {
      setSelectedId(payload.items[0].session.id);
    }
    return payload.items;
  };

  const loadMoreSessions = async () => {
    setError(null);
    setIsLoadingMoreSessions(true);

    try {
      const nextLimit = loadedSessionLimitRef.current + SESSION_HISTORY_PAGE_SIZE;
      const payload = await readJson<SessionHistoryListResponse>(
        `/api/sessions?limit=${SESSION_HISTORY_PAGE_SIZE}&offset=${sessions.length}`
      );
      setSessions((current) => mergeSessionPages(current, payload.items));
      setTotalSessionCount(payload.totalCount);
      loadedSessionLimitRef.current = Math.min(nextLimit, payload.totalCount);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
    } finally {
      setIsLoadingMoreSessions(false);
    }
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

    if (selectedId === sessionId) {
      setActiveStreamRunId(payload.run?.status === "running" ? payload.run.id : null);
    }
    return payload;
  };

  const syncSessionState = async (sessionId: string) => {
    const [, payload] = await Promise.all([refreshSessions(), refreshDetail(sessionId)]);
    if (payload.run && payload.run.status !== "running") {
      setActiveRunSessionId((current) => (current === sessionId ? null : current));
      setActiveStreamRunId(null);
      if (
        payload.run?.status === "failed" &&
        payload.run.errorMessage &&
        payload.run.errorMessage !== RUN_STOPPED_BY_USER_MESSAGE
      ) {
        setError(payload.run.errorMessage);
      }
      return payload;
    }

    if (payload.run?.status === "running") {
      setActiveStreamRunId(payload.run.id);
    }

    return payload;
  };

  const refreshProviderCatalog = async (options?: { force?: boolean }) => {
    setIsRefreshingModels(true);
    try {
      const catalog = await readJson<ProviderOption[]>(
        options?.force ? "/api/providers/models?refresh=true" : "/api/providers/models"
      );
      setProviderOptions(catalog);
      setSavedConnectionState(deriveConnectionStateFromProviderOptions(catalog, savedSettings.providerId, savedSettings.authMode));
      setDraftConnectionState(deriveConnectionStateFromProviderOptions(catalog, connectionDraft.providerId, connectionDraft.authMode));
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

  const launchRun = (sessionId: string) => {
    setActiveRunSessionId(sessionId);
    setActiveStreamRunId(null);
    setLiveMessages((current) => removeLiveMessagesForSession(current, sessionId));

    void readJson<RunRouteResponse>(`/api/sessions/${sessionId}/run`, {
      method: "POST"
    })
      .then(async (runResponse) => {
        await syncSessionState(sessionId);
        setActiveStreamRunId(runResponse.runId);
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
          setActiveStreamRunId(null);
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

    if (
      !shouldRefreshDraftConnectionState({
        providerId: connectionDraft.providerId,
        authMode: connectionDraft.authMode,
        currentState: draftConnectionState
      })
    ) {
      return;
    }

    startTransition(() => {
      setDraftConnectionState(deriveConnectionStateFromProviderOptions(providerOptions, connectionDraft.providerId, connectionDraft.authMode));
    });
  }, [connectionDraft.authMode, connectionDraft.providerId, copy.errorFallback]);

  useEffect(() => {
    if (!savedSettings.providerId || !savedSettings.authMode) {
      return;
    }

    if (!providerOptions.length || !shouldRefreshSavedConnectionStateOnMount({
      providerId: savedSettings.providerId,
      authMode: savedSettings.authMode,
      currentState: savedConnectionState
    })) {
      return;
    }

    startTransition(() => {
      setSavedConnectionState(deriveConnectionStateFromProviderOptions(providerOptions, savedSettings.providerId, savedSettings.authMode));
    });
  }, [providerOptions, savedConnectionState, savedSettings.authMode, savedSettings.providerId]);

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
    if (!form.enableWebSearch || sessionModel?.supportsWebSearch) {
      return;
    }

    setForm((current) => ({
      ...current,
      enableWebSearch: false
    }));
  }, [form.enableWebSearch, sessionModel?.supportsWebSearch]);

  useEffect(() => {
    if (!shouldRefreshProviderCatalogOnMount(providerOptions)) {
      return;
    }

    startTransition(() => {
      refreshProviderCatalog().catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
      });
    });
  }, [providerOptions, copy.errorFallback]);

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

      if (!isMatchingSessionRunEvent(payload, selectedId, streamRunId)) {
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
          targetAgentKey: payload.targetAgentKey ?? current?.targetAgentKey ?? null,
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
          targetAgentKey: payload.targetAgentKey ?? current?.targetAgentKey ?? null,
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
          targetAgentKey: payload.targetAgentKey ?? null,
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
  }, [selectedId, isSelectedSessionRunning, detail?.run?.id, streamRunId]);

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
      await refreshProviderCatalog({ force: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
    } finally {
      setIsSavingConnection(false);
    }
  };

  const loadMcpSettings = async () => {
    const response = await readJson<McpSettingsDraft>("/api/settings/mcp");
    setMcpSettings(response);
    return response;
  };

  const loadSkillsSettings = async () => {
    const response = await readJson<SkillsSettingsDraft>("/api/settings/skills");
    setSkillsSettings(response);
    return response;
  };

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    void Promise.all([loadMcpSettings(), loadSkillsSettings()]).catch((requestError) => {
      setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
    });
  }, [isSettingsOpen]);

  const handleSaveMcpSettings = async () => {
    setError(null);
    setIsSavingMcpSettings(true);

    try {
      const response = await readJson<McpSettingsDraft>("/api/settings/mcp", {
        method: "POST",
        body: JSON.stringify(mcpSettings)
      });
      setMcpSettings(response);
      setSavedSettings((current) => ({ ...current, enableMcp: response.enabled }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
    } finally {
      setIsSavingMcpSettings(false);
    }
  };

  const handleSaveSkillsSettings = async () => {
    setError(null);
    setIsSavingSkillsSettings(true);

    try {
      const response = await readJson<SkillsSettingsDraft>("/api/settings/skills", {
        method: "POST",
        body: JSON.stringify({
          enabled: skillsSettings.enabled,
          managed: skillsSettings.managed.map((skill) => ({
            name: skill.name,
            description: skill.description,
            content: skill.content,
            enabled: skill.enabled
          }))
        })
      });
      setSkillsSettings(response);
      setSavedSettings((current) => ({ ...current, enableSkills: response.enabled }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
    } finally {
      setIsSavingSkillsSettings(false);
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
          const nextSavedConnection = deriveConnectionStateFromProviderOptions(
            providerOptions,
            response.settings.providerId,
            response.settings.authMode
          );
          setDraftConnectionState(nextSavedConnection);
          return response;
        },
        waitForCompletion: async () =>
          waitForOauthAutoCompletion({
            isConnected: async () => {
              const catalog = await refreshProviderCatalog({ force: true });
              const connection = deriveConnectionStateFromProviderOptions(catalog, pendingProviderId, pendingAuthModeId);
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
        const catalog = await refreshProviderCatalog({ force: true });
        const nextConnection = deriveConnectionStateFromProviderOptions(
          catalog,
          flow.pendingOauth.providerId,
          flow.pendingOauth.authModeId
        );
        setSavedConnectionState(nextConnection);
        oauthPopupRef.current?.close();
        oauthPopupRef.current = null;
        setPendingOauth((current) =>
          current?.providerId === flow.pendingOauth.providerId && current.authModeId === flow.pendingOauth.authModeId ? null : current
        );
        setError(null);
      }).catch((requestError) => {
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
      const catalog = await refreshProviderCatalog({ force: true });
      const nextConnection = deriveConnectionStateFromProviderOptions(catalog, pendingOauth.providerId, pendingOauth.authModeId);
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
      const catalog = await refreshProviderCatalog({ force: true });
      const nextConnection = deriveConnectionStateFromProviderOptions(catalog, connectionDraft.providerId, connectionDraft.authMode);
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
      setGeneratedPresetSource({
        prompt: generatedPresetPrompt,
        agentCount: generatedPresetAgentCount,
        language: form.language,
        model: form.model,
        providerId: savedSettings.providerId
      });
      setForm((current) => ({ ...current, presetId: response.preset.id }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
    } finally {
      setIsGeneratingPreset(false);
    }
  };

  const handleOpenPresetStudio = () => {
    setShouldReturnToSession(true);
    setIsCreateSessionOpen(false);
    setIsSettingsOpen(true);
    setSettingsTab("preset");
  };

  const handleOpenSettings = () => {
    setShouldReturnToSession(false);
    setIsSettingsOpen(true);
    setSettingsTab("connection");
  };

  const handleCloseSettings = () => {
    setShouldReturnToSession(false);
    setIsSettingsOpen(false);
    setSettingsTab("connection");
  };

  const handleReturnToSession = () => {
    setShouldReturnToSession(false);
    setIsSettingsOpen(false);
    setIsCreateSessionOpen(true);
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
            customPreset: resolveCustomPresetForSessionCreate({
              presetId: form.presetId,
              selectedPreset
            }),
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
      setActiveStreamRunId(null);
      await syncSessionState(selectedId).catch(() => undefined);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
    } finally {
      setIsStoppingRun(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    const target = sessions.find((entry) => entry.session.id === sessionId);
    if (!target) {
      return;
    }

    const confirmed = window.confirm(`${copy.sessions.confirmDelete}

${target.session.title}`);
    if (!confirmed) {
      return;
    }

    setError(null);
    setDeletingSessionId(sessionId);

    try {
      await readJson<{ deletedSessionId: string }>(`/api/sessions/${sessionId}`, {
        method: "DELETE"
      });
      const nextSessions = sessions.filter((entry) => entry.session.id !== sessionId);
      const nextSelectedId = getNextSelectedSessionIdAfterDelete(nextSessions, sessionId, selectedId);
      setSelectedId(nextSelectedId);
      if (selectedId === sessionId) {
        setDetail(null);
        setLiveMessages((current) => removeLiveMessagesForSession(current, sessionId));
        setSelectedMessageId(null);
        setSelectedAgentKey(null);
      }
      setSessions(nextSessions);
      setTotalSessionCount((current) => Math.max(0, current - 1));
      const preservedLimit = Math.max(loadedSessionLimitRef.current, SESSION_HISTORY_PAGE_SIZE);
      loadedSessionLimitRef.current = preservedLimit;
      await refreshSessions({ limit: preservedLimit });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.errorFallback);
    } finally {
      setDeletingSessionId(null);
    }
  };

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
  const detailedMessageInfo = useMemo(() => {
    if (!selectedMessageId || !debateVisualization) return null;
    for (const round of debateVisualization.timeline) {
      const msg = round.messages.find(m => m.id === selectedMessageId);
      if (msg) {
        return { round, message: msg };
      }
    }
    return null;
  }, [selectedMessageId, debateVisualization]);

  const selectedAgentMessages = useMemo(() => {
    if (!selectedAgentKey || !debateVisualization) return [];
    const msgs = [];
    for (const round of debateVisualization.timeline) {
      for (const msg of round.messages) {
        if (msg.agentKey === selectedAgentKey) {
          msgs.push({ round, message: msg });
        }
      }
    }
    return msgs;
  }, [selectedAgentKey, debateVisualization]);

  const selectedAgentInfo = useMemo(() => {
    if (!selectedAgentKey || !debateVisualization) return null;
    return debateVisualization.agents.find(a => a.agentKey === selectedAgentKey) ?? null;
  }, [selectedAgentKey, debateVisualization]);

  useEffect(() => {
    if (!isSelectedSessionRunning) {
      return;
    }

    // scroll logic removed since timeline is hidden
  }, [
    isSelectedSessionRunning,
    detail?.rounds.length,
    detail?.rounds[detail?.rounds.length ? detail.rounds.length - 1 : 0]?.messages.length
  ]);

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-[#0b0f19] text-gray-100 selection:bg-blue-500/30">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.12),_transparent_48%),radial-gradient(circle_at_85%_10%,_rgba(244,104,73,0.1),_transparent_38%),linear-gradient(180deg,_rgba(255,255,255,0.03),_transparent_45%)]" />
      <div className="relative z-10 flex h-screen flex-col">
        <CouncilHeader
          copy={copy}
          uiLocale={uiLocale}
          onOpenSettings={handleOpenSettings}
          onUiLocaleChange={setUiLocale}
        />

        {error ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-100">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-red-300" />
            <span>{error}</span>
          </div>
        ) : null}

        <main className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[260px_minmax(0,_1fr)_380px]">
          <div className="relative flex min-h-0 flex-col overflow-hidden bg-[#121826] border-r border-gray-800 shrink-0">
            <SessionSidebar
              copy={copy}
              uiLocale={uiLocale}
              sessions={sessions}
              totalSessionCount={totalSessionCount}
              selectedId={selectedId}
              activeRunSessionId={activeRunSessionId}
              isLoadingMore={isLoadingMoreSessions}
              deletingSessionId={deletingSessionId}
              onOpenCreateSession={() => setIsCreateSessionOpen(true)}
              onSelectSession={setSelectedId}
              onLoadMoreSessions={loadMoreSessions}
              onDeleteSession={handleDeleteSession}
            />
          </div>

          <section className="relative flex min-h-0 flex-col overflow-hidden bg-[#0b0f19]">
            <header className="px-8 py-6 flex items-center justify-between border-b border-gray-800 shrink-0 bg-[#0b0f19]/80 backdrop-blur-md z-10">
              <div>
                <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                  {timelineTitle || copy.detail.emptyTitle}
                  {detail?.run?.status === "completed" || selectedSessionSummary?.session.status === "completed" ? (
                    <span className="px-2.5 py-1 bg-green-500/10 text-green-400 text-xs font-semibold rounded-full border border-green-500/20 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      {copy.statuses.completed}
                    </span>
                  ) : null}

                  {isSelectedSessionRunning ? (
                    <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 text-xs font-semibold rounded-full border border-blue-500/20 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      {copy.detail.live}
                    </span>
                  ) : null}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="px-2.5 py-1.5 bg-gray-800/80 text-gray-300 text-xs font-medium rounded-lg border border-gray-700/50">
                    {detail?.session.provider ?? selectedSessionSummary?.session.provider ?? connectionProvider?.label ?? copy.noProvider}
                  </Badge>
                  <Badge className="px-2.5 py-1.5 bg-gray-800/80 text-gray-300 text-xs font-medium rounded-lg border border-gray-700/50">
                    {detail?.session.model ?? selectedSessionSummary?.session.model ?? sessionModel?.label ?? copy.noModel}
                  </Badge>
                  {detail?.session || selectedSessionSummary ? (
                    <Badge className="px-2.5 py-1.5 bg-gray-800/80 text-gray-300 text-xs font-medium rounded-lg border border-gray-700/50">
                      {getUiLanguageLabel(
                        (detail?.session.language ?? selectedSessionSummary?.session.language ?? "ko") as SessionLanguage,
                        uiLocale
                      )}
                    </Badge>
                  ) : null}
                  {detail?.session || selectedSessionSummary ? (
                    <Badge className="px-2.5 py-1.5 bg-gray-800/80 text-gray-300 text-xs font-medium rounded-lg border border-gray-700/50">
                      {getDebateIntensityLabel(
                        (detail?.session.debateIntensity ??
                          selectedSessionSummary?.session.debateIntensity ??
                          DEBATE_INTENSITY_DEFAULT) as number,
                        uiLocale
                      )}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </header>

            <div className="council-scrollbar flex-1 overflow-y-auto px-6 py-6">
              {detail && debateVisualization ? (
                <LiveWorkspacePanel
                  copy={copy}
                  uiLocale={uiLocale}
                  detail={detail}
                  debateVisualization={debateVisualization}
                  activePreset={activePreset}
                  timelineTitle={timelineTitle}
                  isSelectedSessionRunning={isSelectedSessionRunning}
                  onSelectMessage={setSelectedMessageId}
                  onSelectAgent={setSelectedAgentKey}
                />
              ) : null}

              {!detail ? (
                <div className="flex min-h-[560px] flex-col items-center justify-center border border-dashed border-gray-800/40 px-6 text-center">
                  <Users size={34} className="mb-4 text-gray-700" />
                  <p className="text-sm font-medium text-gray-300">{copy.detail.emptyTitle}</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">{copy.detail.emptyDescription}</p>
                </div>
              ) : null}

              <div ref={timelineEndRef} />
            </div>
          </section>

          <div className="relative flex min-h-0 flex-col overflow-hidden bg-[#121826] border-l border-gray-800 shrink-0">
            <DecisionSidebar
              copy={copy}
              uiLocale={uiLocale}
              detail={detail}
              selectedId={selectedId}
              isSubmitting={isSubmitting}
              isStoppingRun={isStoppingRun}
              isSelectedSessionRunning={isSelectedSessionRunning}
              onRerun={handleRerun}
              onStop={handleStop}
            />
          </div>
        </main>
      </div>

      <SettingsModal
        copy={copy}
        uiLocale={uiLocale}
        isOpen={isSettingsOpen}
        settingsTab={settingsTab}
        shouldReturnToSession={shouldReturnToSession}
        providerOptions={providerOptions}
        connectionDraft={connectionDraft}
        connectionProvider={connectionProvider}
        connectionAuthOption={connectionAuthOption}
        hasProviders={hasProviders}
        isProviderConnected={isProviderConnected}
        isSavingConnection={isSavingConnection}
        isSavingMcpSettings={isSavingMcpSettings}
        isSavingSkillsSettings={isSavingSkillsSettings}
        isSettingsConnectionSaved={isSettingsConnectionSaved}
        isPresetTabLocked={isPresetTabLocked}
        isRefreshingModels={isRefreshingModels}
        isGeneratingPreset={isGeneratingPreset}
        isPresetGenerationSuccess={isPresetGenerationSuccess}
        isConnectionDirty={isConnectionDirty}
        pendingOauth={pendingOauth}
        savedSettings={savedSettings}
        mcpSettings={mcpSettings}
        skillsSettings={skillsSettings}
        savedConnectionState={savedConnectionState}
        sessionProvider={sessionProvider}
        sessionModelOptions={sessionModelOptions}
        sessionLanguageOptions={sessionLanguageOptions}
        thinkingOptions={thinkingOptions}
        selectedLanguage={selectedLanguage}
        form={form}
        generatedPresetPrompt={generatedPresetPrompt}
        generatedPresetAgentCount={generatedPresetAgentCount}
        generatedPreset={generatedPreset}
        onClose={handleCloseSettings}
        onReturnToSession={handleReturnToSession}
        onSwitchTab={setSettingsTab}
        onConnectionProviderChange={(providerId) => {
          const nextProvider = providerOptions.find((provider) => provider.id === providerId) ?? providerOptions[0];
          setConnectionDraft((current) =>
            reconcileConnection(
              providerOptions,
              {
                ...current,
                providerId,
                authMode: nextProvider ? pickPreferredAuthModeId(nextProvider.authModes, current.authMode) : current.authMode,
                apiKey: ""
              },
              { providerId: defaultProvider, authMode: defaultAuthMode }
            )
          );
        }}
        onConnectionAuthModeChange={(authMode) => setConnectionDraft((current) => ({ ...current, authMode, apiKey: "" }))}
        onConnectionApiKeyChange={(apiKey) => setConnectionDraft((current) => ({ ...current, apiKey }))}
        onPendingOauthCodeChange={(code) => setPendingOauth((current) => (current ? { ...current, code } : current))}
        onSaveConnection={handleSaveConnection}
        onOpenLogin={handleOpenLogin}
        onCompleteOauth={handleCompleteOauth}
        onDisconnectAuth={handleDisconnectAuth}
        onMcpSettingsChange={setMcpSettings}
        onSaveMcpSettings={handleSaveMcpSettings}
        onSkillsSettingsChange={setSkillsSettings}
        onSaveSkillsSettings={handleSaveSkillsSettings}
        onFormChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        onGeneratedPresetPromptChange={setGeneratedPresetPrompt}
        onGeneratedPresetAgentCountChange={setGeneratedPresetAgentCount}
        onGeneratePreset={handleGeneratePreset}
      />

      <CreateSessionModal
        copy={copy}
        uiLocale={uiLocale}
        isOpen={isCreateSessionOpen}
        form={form}
        availablePresets={availablePresets}
        activePreset={activePreset}
        generatedPreset={generatedPreset}
        savedProvider={savedProvider}
        savedAuthOption={savedAuthOption}
        savedConnectionState={savedConnectionState}
        selectedLanguage={selectedLanguage}
        selectedDebateIntensityLabel={selectedDebateIntensityLabel}
        selectedDebateIntensityDescription={selectedDebateIntensityDescription}
        selectedThinkingIntensityLabel={selectedThinkingIntensityLabel}
        selectedThinkingIntensityDescription={selectedThinkingIntensityDescription}
        sessionProvider={sessionProvider}
        sessionModel={sessionModel}
        sessionModelOptions={sessionModelOptions}
        sessionLanguageOptions={sessionLanguageOptions}
        thinkingOptions={thinkingOptions}
        isConnectionDirty={isConnectionDirty}
        isRefreshingModels={isRefreshingModels}
        isSubmitting={isSubmitting}
        onClose={() => setIsCreateSessionOpen(false)}
        onOpenPresetStudio={handleOpenPresetStudio}
        onCreate={handleCreate}
        onFormChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
      />

      {detailedMessageInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="message-dialog-title" className="flex flex-col w-full max-w-3xl max-h-[90vh] rounded-[24px] border border-gray-800 bg-[#060913] shadow-[0_24px_50px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 bg-[#090d1a]">
              <div id="message-dialog-title" className="flex items-center gap-2 rounded-full border border-gray-800 bg-gray-900 px-4 py-1.5">
                <Badge className="border-gray-700 bg-gray-800 text-gray-300">
                  {copy.detail.round} {detailedMessageInfo.round.roundNumber}
                </Badge>
                <span className="text-xs font-semibold tracking-[0.14em] text-gray-400">
                  {getRoundStageLabel(detailedMessageInfo.round.stage, uiLocale)}
                </span>
              </div>
              <button aria-label={getCloseLabel(uiLocale)} className="text-gray-400 hover:text-white" onClick={() => setSelectedMessageId(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="council-scrollbar flex-1 overflow-y-auto p-6 bg-[#060913]">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-4">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-gray-100">{detailedMessageInfo.message.agentName}</p>
                  <p className="text-sm text-gray-500">
                    {activePreset?.agents.find((agent) => agent.key === detailedMessageInfo.message.agentKey)?.role ?? detailedMessageInfo.message.role}
                  </p>
                </div>
                <Badge className={cn(
                  "border-gray-700 bg-gray-800 text-gray-300",
                  detailedMessageInfo.message.isStreaming && "border-blue-400/20 bg-blue-500/10 text-blue-200"
                )}>
                  {detailedMessageInfo.message.isStreaming ? `${getMessageKindLabel(detailedMessageInfo.message.kind, uiLocale)} · Live` : getMessageKindLabel(detailedMessageInfo.message.kind, uiLocale)}
                </Badge>
              </div>

              {detailedMessageInfo.message.reasoning ? (
                <div className="mb-6 rounded-2xl border border-blue-500/15 bg-blue-500/5 px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300/80 mb-3 flex items-center gap-2">
                    <Lightbulb size={14} className="text-blue-400" />
                    생각 과정 (Reasoning Process)
                  </p>
                  <MarkdownContent
                    content={detailedMessageInfo.message.reasoning}
                    className="text-sm text-blue-100/90 [&_a]:text-blue-200 [&_blockquote]:border-blue-300/30 [&_code]:border-blue-200/20 [&_code]:bg-blue-950/30 [&_hr]:border-blue-300/20 [&_pre]:border-blue-200/20 [&_pre]:bg-blue-950/40 [&_table]:border-blue-300/20 [&_tbody_tr]:border-blue-300/15 [&_th]:bg-blue-300/10"
                  />
                </div>
              ) : null}

              <div>
                <MarkdownContent content={detailedMessageInfo.message.content} className="text-[15px] text-gray-200" />
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedAgentInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="agent-dialog-title" className="flex flex-col w-full max-w-4xl max-h-[90vh] rounded-[24px] border border-gray-800 bg-[#060913] shadow-[0_24px_50px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 bg-[#090d1a]">
              <div className="flex items-center flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", getAgentVisual(selectedAgentInfo.agentKey, selectedAgentInfo.role).bg, getAgentVisual(selectedAgentInfo.agentKey, selectedAgentInfo.role).border)}>
                    {(() => {
                      const Icon = getAgentVisual(selectedAgentInfo.agentKey, selectedAgentInfo.role).icon;
                      return <Icon size={18} className={getAgentVisual(selectedAgentInfo.agentKey, selectedAgentInfo.role).color} />;
                    })()}
                  </div>
                  <div>
                    <h2 id="agent-dialog-title" className="text-lg font-bold text-gray-100">{selectedAgentInfo.agentName}</h2>
                    <p className="text-xs text-gray-500">{selectedAgentInfo.role}</p>
                  </div>
                </div>
                <Badge className="border-gray-700 bg-gray-900 text-gray-300 ml-4">
                  {selectedAgentMessages.length}개 메시지
                </Badge>
              </div>
              <button aria-label={getCloseLabel(uiLocale)} className="text-gray-400 hover:text-white shrink-0" onClick={() => setSelectedAgentKey(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="council-scrollbar flex-1 overflow-y-auto p-6 bg-[#060913] space-y-6">
              {selectedAgentMessages.length === 0 ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[20px] border border-dashed border-gray-800 bg-gray-900/30 p-8 text-center">
                  <p className="text-gray-500">아직 등록된 메시지가 없습니다.</p>
                </div>
              ) : selectedAgentMessages.map((m, idx) => (
                <div key={m.message.id} className="rounded-[20px] border border-gray-800 bg-gray-900/60 p-5 relative">
                  <div className="absolute top-5 right-5 text-[10px] font-semibold text-gray-600">#{idx + 1}</div>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Badge className="border-gray-700 bg-gray-800 text-gray-300">
                      라운드 {m.round.roundNumber}
                    </Badge>
                    <Badge className="border-gray-700 bg-gray-800 text-gray-300">
                      {getRoundStageLabel(m.round.stage, uiLocale)}
                    </Badge>
                    <Badge className={cn("border-gray-700 bg-gray-800 text-gray-300", m.message.isStreaming && "border-blue-400/20 bg-blue-500/10 text-blue-200")}>
                      {m.message.isStreaming ? `${getMessageKindLabel(m.message.kind, uiLocale)} · Live` : getMessageKindLabel(m.message.kind, uiLocale)}
                    </Badge>
                  </div>

                  {m.message.reasoning ? (
                    <div className="mb-5 rounded-xl border border-blue-500/15 bg-blue-500/5 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300/80 mb-2 flex items-center gap-2">
                        <Lightbulb size={12} className="text-blue-400" />
                        생각 과정
                      </p>
                      <MarkdownContent
                        content={m.message.reasoning}
                        className="text-xs text-blue-100/70 [&_a]:text-blue-200 [&_blockquote]:border-blue-300/30 [&_code]:border-blue-200/20 [&_code]:bg-blue-950/30 [&_hr]:border-blue-300/20 [&_pre]:border-blue-200/20 [&_pre]:bg-blue-950/40 [&_table]:border-blue-300/20 [&_tbody_tr]:border-blue-300/15 [&_th]:bg-blue-300/10"
                      />
                    </div>
                  ) : null}

                  <MarkdownContent content={m.message.content} className="text-sm text-gray-200" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
