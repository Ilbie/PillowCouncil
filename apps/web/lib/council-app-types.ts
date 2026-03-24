import type { LiveMessageRecord, PresetDefinition, SessionCreateInput, SessionLanguage } from "@ship-council/shared";
import type { McpSettingsState, SkillsSettingsState } from "@ship-council/providers";

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
