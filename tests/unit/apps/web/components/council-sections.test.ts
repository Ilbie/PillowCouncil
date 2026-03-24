import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { SessionDetailResponse, SessionSummary } from "@ship-council/shared";

import { CouncilHeader } from "../../../../../apps/web/components/council/CouncilHeader.tsx";
import { CreateSessionModal } from "../../../../../apps/web/components/council/CreateSessionModal.tsx";
import { DecisionSidebar } from "../../../../../apps/web/components/council/DecisionSidebar.tsx";
import { LiveWorkspacePanel } from "../../../../../apps/web/components/council/LiveWorkspacePanel.tsx";
import { SettingsModal } from "../../../../../apps/web/components/council/SettingsModal.tsx";
import { SessionSidebar } from "../../../../../apps/web/components/council/SessionSidebar.tsx";
import { getUiCopy } from "../../../../../apps/web/lib/i18n.ts";
import type { SessionFormState } from "../../../../../apps/web/lib/council-app-types";

const copy = getUiCopy("en");

const sessionSummary: SessionSummary = {
  session: {
    id: "session-1",
    title: "Quarterly Launch",
    prompt: "Should we launch this quarter?",
    presetId: "custom:test",
    customPreset: null,
    provider: "openai",
    model: "gpt-4.1",
    enableWebSearch: false,
    thinkingIntensity: "balanced",
    debateIntensity: 2,
    roundCount: 4,
    language: "en",
    status: "running",
    currentRunId: "run-1",
    createdAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z"
  },
  run: {
    id: "run-1",
    sessionId: "session-1",
    status: "running",
    workerId: null,
    claimedAt: null,
    startedAt: "2026-03-24T00:00:00.000Z",
    completedAt: null,
    errorMessage: null,
    debateState: { agreedPoints: [], activeConflicts: [], pendingQuestions: [] },
    mcpCalls: 2,
    skillUses: 1,
    webSearches: 3,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    createdAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z"
  }
};

const detail: SessionDetailResponse = {
  session: sessionSummary.session,
  run: {
    ...sessionSummary.run!,
    status: "completed",
    completedAt: "2026-03-24T00:05:00.000Z"
  },
  rounds: [],
  decision: {
    id: "decision-1",
    sessionId: "session-1",
    runId: "run-1",
    topRecommendation: "Launch with a phased rollout.",
    alternatives: [],
    risks: ["Support capacity may be tight."],
    assumptions: [],
    openQuestions: [],
    nextActions: [],
    finalSummary: "Proceed carefully with monitoring.",
    createdAt: "2026-03-24T00:05:00.000Z"
  },
  todos: [],
  usage: {
    totalPromptTokens: 10,
    totalCompletionTokens: 5
  },
  activityMetrics: {
    mcpCalls: 2,
    skillUses: 1,
    webSearches: 3,
    inputTokens: 10,
    outputTokens: 5,
    workDurationMs: 300000
  }
};

const providerOptions = [
  {
    id: "openai",
    label: "OpenAI",
    description: "provider",
    npmPackage: "pkg",
    connected: true,
    authModes: [
      {
        id: "oauth:1",
        type: "oauth" as const,
        methodIndex: 1,
        label: "OAuth",
        description: "oauth login",
        envKeys: []
      }
    ],
    models: [
      {
        id: "gpt-4.1",
        label: "GPT-4.1",
        description: "model",
        supportsStructuredOutput: true
      }
    ]
  }
];

const form: SessionFormState = {
  title: "",
  prompt: "Should we launch this quarter?",
  presetId: "custom:test",
  model: "gpt-4.1",
  enableWebSearch: false,
  thinkingIntensity: "balanced",
  debateIntensity: 2,
  language: "en"
};

const visualization = {
  summary: {
    expectedRounds: 4,
    completedRounds: 1,
    messageCount: 2,
    activeStage: "opening" as const
  },
  stages: [
    {
      key: "opening" as const,
      expectedRounds: 2,
      completedRounds: 1,
      pendingRounds: 1,
      status: "active" as const,
      progressRatio: 0.5,
      currentRoundNumber: 1,
      currentSpeakerCount: 1,
      totalSpeakerCount: 2
    }
  ],
  agents: [
    {
      agentKey: "pm",
      agentName: "PM",
      role: "Product Manager",
      contributionCount: 1,
      status: "active" as const
    }
  ],
  activityFeed: [
    {
      type: "message" as const,
      id: "msg-1",
      stage: "opening" as const,
      agentKey: "pm",
      agentName: "PM",
      kind: "opinion",
      label: "Launch with a phased rollout.",
      createdAt: "2026-03-24T00:00:00.000Z",
      isStreaming: false
    }
  ],
  timeline: [
    {
      id: "round-1",
      roundNumber: 1,
      stage: "opening" as const,
      title: "Opinion 1",
      summary: null,
      messages: [
        {
          id: "msg-1",
          roundId: "round-1",
          agentKey: "pm",
          agentName: "PM",
          role: "agent" as const,
          kind: "opinion" as const,
          targetAgentKey: null,
          content: "Launch with a phased rollout.",
          reasoning: "",
          createdAt: "2026-03-24T00:00:00.000Z",
          isStreaming: false
        }
      ]
    }
  ]
};

describe("council sections", () => {
  it("renders the top header labels", () => {
    const html = renderToStaticMarkup(
      React.createElement(CouncilHeader, {
        copy,
        uiLocale: "en",
        onOpenSettings: () => undefined,
        onUiLocaleChange: () => undefined
      })
    );

    expect(html).toContain("Ship Council");
    expect(html).toContain(copy.connection.title);
    expect(html).toContain(copy.uiLanguageLabel);
  });

  it("renders the session sidebar summary cards", () => {
    const html = renderToStaticMarkup(
      React.createElement(SessionSidebar, {
        copy,
        uiLocale: "en",
        sessions: [sessionSummary],
        selectedId: "session-1",
        activeRunSessionId: "session-1",
        onOpenCreateSession: () => undefined,
        onSelectSession: () => undefined
      })
    );

    expect(html).toContain("Quarterly Launch");
    expect(html).toContain(copy.sessions.title);
    expect(html).toContain("Should we launch this quarter?");
  });

  it("renders the decision sidebar recommendation and risks", () => {
    const html = renderToStaticMarkup(
      React.createElement(DecisionSidebar, {
        copy,
        uiLocale: "en",
        detail,
        selectedId: "session-1",
        isSubmitting: false,
        isStoppingRun: false,
        isSelectedSessionRunning: false,
        onRerun: () => undefined,
        onStop: () => undefined
      })
    );

    expect(html).toContain(copy.decision.title);
    expect(html).toContain("Launch with a phased rollout.");
    expect(html).toContain("Support capacity may be tight.");
  });

  it("does not render the activity metrics card in the decision sidebar", () => {
    const html = renderToStaticMarkup(
      React.createElement(DecisionSidebar, {
        copy,
        uiLocale: "en",
        detail,
        selectedId: "session-1",
        isSubmitting: false,
        isStoppingRun: false,
        isSelectedSessionRunning: false,
        onRerun: () => undefined,
        onStop: () => undefined
      })
    );

    expect(html).not.toContain("Activity Metrics");
    expect(html).not.toContain("MCP Calls");
    expect(html).not.toContain("Skills Used");
    expect(html).not.toContain("Web Searches");
    expect(html).not.toContain("Input Tokens");
    expect(html).not.toContain("Output Tokens");
    expect(html).not.toContain("Work Time");
  });

  it("renders the activity metrics card in the live workspace panel", () => {
    const html = renderToStaticMarkup(
      React.createElement(LiveWorkspacePanel, {
        copy,
        uiLocale: "en",
        detail,
        debateVisualization: visualization,
        activePreset: {
          id: "custom:test",
          name: "Test Panel",
          description: "desc",
          agents: [
            {
              key: "pm",
              name: "PM",
              role: "Product Manager",
              goal: "Drive",
              bias: "Customer value",
              style: "Direct",
              systemPrompt: "Argue as PM with practical tradeoffs."
            }
          ]
        },
        timelineTitle: "Quarterly Launch",
        isSelectedSessionRunning: true,
        onSelectAgent: () => undefined,
        onSelectMessage: () => undefined
      })
    );

    const activityMetricsIndex = html.indexOf("Activity Metrics");
    const workspaceDescriptionIndex = html.indexOf("Track the current stage, latest update, and panel momentum even before the first round lands.");
    const panelActivityIndex = html.indexOf("Panel Activity");
    const liveFeedIndex = html.indexOf("Live Feed");

    expect(html).toContain("Activity Metrics");
    expect(html).toContain("MCP Calls");
    expect(html).toContain("Skills Used");
    expect(html).toContain("Web Searches");
    expect(html).toContain("Input Tokens");
    expect(html).toContain("Output Tokens");
    expect(html).toContain("Work Time");
    expect(html).toContain("Panel Activity");
    expect(html).toContain("Live Feed");
    expect(html).toContain("Launch with a phased rollout.");
    expect(workspaceDescriptionIndex).toBeGreaterThanOrEqual(0);
    expect(activityMetricsIndex).toBeLessThan(workspaceDescriptionIndex);
    expect(panelActivityIndex).toBeGreaterThan(workspaceDescriptionIndex);
    expect(liveFeedIndex).toBeGreaterThan(activityMetricsIndex);
  });

  it("renders the settings modal tabs and preset studio shell", () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsModal, {
        copy,
        uiLocale: "en",
        isOpen: true,
        settingsTab: "preset",
        shouldReturnToSession: false,
        providerOptions,
        connectionDraft: { providerId: "openai", authMode: "oauth:1", apiKey: "" },
        connectionProvider: providerOptions[0],
        connectionAuthOption: providerOptions[0].authModes[0],
        hasProviders: true,
        isProviderConnected: true,
        isSavingConnection: false,
        isSavingMcpSettings: false,
        isSavingSkillsSettings: false,
        isSettingsConnectionSaved: true,
        isPresetTabLocked: false,
        isRefreshingModels: false,
        isGeneratingPreset: false,
        isPresetGenerationSuccess: false,
        isConnectionDirty: false,
        pendingOauth: null,
        savedSettings: {
          providerId: "openai",
          modelId: "gpt-4.1",
          authMode: "oauth:1",
          enableMcp: true,
          enableSkills: true,
          updatedAt: "2026-03-24T00:00:00.000Z"
        },
        mcpSettings: {
          enabled: true,
          servers: []
        },
        skillsSettings: {
          enabled: true,
          managed: [],
          available: []
        },
        savedConnectionState: {
          providerId: "openai",
          authModeId: "oauth:1",
          connected: true,
          available: true
        },
        sessionProvider: providerOptions[0],
        sessionModelOptions: providerOptions[0].models,
        sessionLanguageOptions: [{ value: "en", label: "English", description: "English" }],
        thinkingOptions: [{ value: "balanced", label: "Balanced", description: "Balanced" }],
        selectedLanguage: { value: "en", label: "English", description: "English" },
        form,
        generatedPresetPrompt: "A pricing review panel",
        generatedPresetAgentCount: 3,
        onClose: () => undefined,
        onReturnToSession: () => undefined,
        onSwitchTab: () => undefined,
        onConnectionProviderChange: () => undefined,
        onConnectionAuthModeChange: () => undefined,
        onConnectionApiKeyChange: () => undefined,
        onPendingOauthCodeChange: () => undefined,
        onSaveConnection: () => undefined,
        onOpenLogin: () => undefined,
        onCompleteOauth: () => undefined,
        onDisconnectAuth: () => undefined,
        onMcpSettingsChange: () => undefined,
        onSaveMcpSettings: () => undefined,
        onSkillsSettingsChange: () => undefined,
        onSaveSkillsSettings: () => undefined,
        onFormChange: () => undefined,
        onGeneratedPresetPromptChange: () => undefined,
        onGeneratedPresetAgentCountChange: () => undefined,
        onGeneratePreset: () => undefined
      })
    );

    expect(html).toContain("프리셋 스튜디오");
    expect(html).toContain("커스텀 프리셋 생성");
  });

  it("renders separate MCP and skills tabs with list controls", () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsModal, {
        copy,
        uiLocale: "en",
        isOpen: true,
        settingsTab: "mcp",
        shouldReturnToSession: false,
        providerOptions,
        connectionDraft: { providerId: "openai", authMode: "oauth:1", apiKey: "" },
        connectionProvider: providerOptions[0],
        connectionAuthOption: providerOptions[0].authModes[0],
        hasProviders: true,
        isProviderConnected: true,
        isSavingConnection: false,
        isSavingMcpSettings: false,
        isSavingSkillsSettings: false,
        isSettingsConnectionSaved: true,
        isPresetTabLocked: false,
        isRefreshingModels: false,
        isGeneratingPreset: false,
        isPresetGenerationSuccess: false,
        isConnectionDirty: false,
        pendingOauth: null,
        savedSettings: {
          providerId: "openai",
          modelId: "gpt-4.1",
          authMode: "oauth:1",
          enableMcp: true,
          enableSkills: false,
          updatedAt: "2026-03-24T00:00:00.000Z"
        },
        savedConnectionState: {
          providerId: "openai",
          authModeId: "oauth:1",
          connected: true,
          available: true
        },
        sessionProvider: providerOptions[0],
        sessionModelOptions: providerOptions[0].models,
        sessionLanguageOptions: [{ value: "en", label: "English", description: "English" }],
        thinkingOptions: [{ value: "balanced", label: "Balanced", description: "Balanced" }],
        selectedLanguage: { value: "en", label: "English", description: "English" },
        form,
        generatedPresetPrompt: "A pricing review panel",
        generatedPresetAgentCount: 3,
        onClose: () => undefined,
        onReturnToSession: () => undefined,
        onSwitchTab: () => undefined,
        onConnectionProviderChange: () => undefined,
        onConnectionAuthModeChange: () => undefined,
        onConnectionApiKeyChange: () => undefined,
        onPendingOauthCodeChange: () => undefined,
        onSaveConnection: () => undefined,
        onOpenLogin: () => undefined,
        onCompleteOauth: () => undefined,
        onDisconnectAuth: () => undefined,
        mcpSettings: {
          enabled: true,
          servers: [
            {
              name: "github",
              enabled: true,
              type: "local",
              command: ["npx", "@modelcontextprotocol/server-github"],
              status: "connected",
              resourceCount: 3
            }
          ]
        },
        skillsSettings: {
          enabled: true,
          managed: [
            {
              name: "release-checklist",
              description: "Project release checklist",
              content: "# release-checklist",
              enabled: true,
              managed: true,
              location: ".opencode/skills/release-checklist/SKILL.md"
            }
          ],
          available: [
            {
              name: "release-checklist",
              description: "Project release checklist",
              enabled: true,
              managed: true,
              location: ".opencode/skills/release-checklist/SKILL.md"
            }
          ]
        },
        onMcpSettingsChange: () => undefined,
        onSaveMcpSettings: () => undefined,
        onSkillsSettingsChange: () => undefined,
        onSaveSkillsSettings: () => undefined,
        onFormChange: () => undefined,
        onGeneratedPresetPromptChange: () => undefined,
        onGeneratedPresetAgentCountChange: () => undefined,
        onGeneratePreset: () => undefined
      })
    );

    expect(html).toContain("MCP 설정");
    expect(html).toContain("스킬 설정");
    expect(html).toContain("github");
    expect(html).toContain("MCP 추가");
  });

  it("renders the skills tab with managed and discovered skills", () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsModal, {
        copy,
        uiLocale: "en",
        isOpen: true,
        settingsTab: "skills",
        shouldReturnToSession: false,
        providerOptions,
        connectionDraft: { providerId: "openai", authMode: "oauth:1", apiKey: "" },
        connectionProvider: providerOptions[0],
        connectionAuthOption: providerOptions[0].authModes[0],
        hasProviders: true,
        isProviderConnected: true,
        isSavingConnection: false,
        isSavingMcpSettings: false,
        isSavingSkillsSettings: false,
        isSettingsConnectionSaved: true,
        isPresetTabLocked: false,
        isRefreshingModels: false,
        isGeneratingPreset: false,
        isPresetGenerationSuccess: false,
        isConnectionDirty: false,
        pendingOauth: null,
        savedSettings: {
          providerId: "openai",
          modelId: "gpt-4.1",
          authMode: "oauth:1",
          enableMcp: true,
          enableSkills: true,
          updatedAt: "2026-03-24T00:00:00.000Z"
        },
        mcpSettings: { enabled: true, servers: [] },
        skillsSettings: {
          enabled: true,
          managed: [
            {
              name: "release-checklist",
              description: "Project release checklist",
              content: "# release-checklist",
              enabled: true,
              managed: true,
              location: ".opencode/skills/release-checklist/SKILL.md"
            }
          ],
          available: [
            {
              name: "release-checklist",
              description: "Project release checklist",
              enabled: true,
              managed: true,
              location: ".opencode/skills/release-checklist/SKILL.md"
            }
          ]
        },
        savedConnectionState: {
          providerId: "openai",
          authModeId: "oauth:1",
          connected: true,
          available: true
        },
        sessionProvider: providerOptions[0],
        sessionModelOptions: providerOptions[0].models,
        sessionLanguageOptions: [{ value: "en", label: "English", description: "English" }],
        thinkingOptions: [{ value: "balanced", label: "Balanced", description: "Balanced" }],
        selectedLanguage: { value: "en", label: "English", description: "English" },
        form,
        generatedPresetPrompt: "A pricing review panel",
        generatedPresetAgentCount: 3,
        onClose: () => undefined,
        onReturnToSession: () => undefined,
        onSwitchTab: () => undefined,
        onConnectionProviderChange: () => undefined,
        onConnectionAuthModeChange: () => undefined,
        onConnectionApiKeyChange: () => undefined,
        onPendingOauthCodeChange: () => undefined,
        onSaveConnection: () => undefined,
        onOpenLogin: () => undefined,
        onCompleteOauth: () => undefined,
        onDisconnectAuth: () => undefined,
        onMcpSettingsChange: () => undefined,
        onSaveMcpSettings: () => undefined,
        onSkillsSettingsChange: () => undefined,
        onSaveSkillsSettings: () => undefined,
        onFormChange: () => undefined,
        onGeneratedPresetPromptChange: () => undefined,
        onGeneratedPresetAgentCountChange: () => undefined,
        onGeneratePreset: () => undefined
      })
    );

    expect(html).toContain("release-checklist");
    expect(html).toContain("스킬 추가");
  });

  it("renders the create session modal shell", () => {
    const html = renderToStaticMarkup(
      React.createElement(CreateSessionModal, {
        copy,
        uiLocale: "en",
        isOpen: true,
        form,
        availablePresets: [
          {
            id: "custom:test",
            name: "Test Panel",
            description: "desc",
            agents: [
              {
                key: "pm",
                name: "PM",
                role: "Product Manager",
                goal: "Drive",
                bias: "Customer value",
                style: "Direct",
                systemPrompt: "Argue as PM with practical tradeoffs."
              }
            ]
          }
        ],
        activePreset: {
          id: "custom:test",
          name: "Test Panel",
          description: "desc",
          agents: [
            {
              key: "pm",
              name: "PM",
              role: "Product Manager",
              goal: "Drive",
              bias: "Customer value",
              style: "Direct",
              systemPrompt: "Argue as PM with practical tradeoffs."
            }
          ]
        },
        generatedPreset: null,
        savedProvider: providerOptions[0],
        savedAuthOption: providerOptions[0].authModes[0],
        savedConnectionState: {
          providerId: "openai",
          authModeId: "oauth:1",
          connected: true,
          available: true
        },
        selectedLanguage: { value: "en", label: "English", description: "English" },
        selectedDebateIntensityLabel: "2 cycles",
        selectedDebateIntensityDescription: "Balanced rounds",
        selectedThinkingIntensityLabel: "Balanced",
        selectedThinkingIntensityDescription: "Balanced thinking",
        sessionProvider: providerOptions[0],
        sessionModel: providerOptions[0].models[0],
        sessionModelOptions: providerOptions[0].models,
        sessionLanguageOptions: [{ value: "en", label: "English", description: "English" }],
        thinkingOptions: [{ value: "balanced", label: "Balanced", description: "Balanced" }],
        isConnectionDirty: false,
        isRefreshingModels: false,
        isSubmitting: false,
        onClose: () => undefined,
        onOpenPresetStudio: () => undefined,
        onCreate: () => undefined,
        onFormChange: () => undefined
      })
    );

    expect(html).toContain(copy.session.title);
    expect(html).toContain(copy.session.topicLabel);
    expect(html).toContain("Test Panel");
  });
});
