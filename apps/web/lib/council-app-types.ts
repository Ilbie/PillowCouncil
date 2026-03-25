import type { LiveMessageRecord, PresetDefinition, SessionCreateInput, SessionLanguage, SessionListResponse } from "@pillow-council/shared";
import type { McpSettingsState, SkillsSettingsState } from "@pillow-council/providers";

import type { ProviderOauthPendingState } from "@/lib/provider-auth";

export type SessionFormState = Pick<
  SessionCreateInput,
  "title" | "prompt" | "presetId" | "model" | "enableWebSearch" | "thinkingIntensity" | "debateIntensity" | "language"
>;

export type SettingsTab = "connection" | "mcp" | "skills" | "preset";

export type McpSettingsDraft = McpSettingsState;
export type SkillsSettingsDraft = SkillsSettingsState;

export type GeneratedPresetInputs = {
  prompt: string;
  agentCount: number;
  language: SessionLanguage;
  model: string;
  providerId: string;
};

export type PendingOauthState = ProviderOauthPendingState;

export type GeneratedPresetResponse = {
  preset: PresetDefinition;
};

export type RunRouteResponse = {
  runId: string;
  run: {
    status: string;
    errorMessage: string | null;
  };
};

export type LiveMessageMap = Record<string, LiveMessageRecord>;

export const SESSION_HISTORY_PAGE_SIZE = 12;

export type SessionHistoryListResponse = SessionListResponse;
