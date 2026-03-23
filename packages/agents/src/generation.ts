import crypto from "node:crypto";

import { z } from "zod";

import { SESSION_LANGUAGES, type PresetDefinition, type SessionLanguage } from "@ship-council/shared";

import {
  CUSTOM_PRESET_ID_PREFIX,
  GENERATED_PRESET_AGENT_COUNT_MAX,
  GENERATED_PRESET_AGENT_COUNT_MIN
} from "./constants";

export const presetGenerationInputSchema = z.object({
  prompt: z.string().trim().min(10).max(2000),
  agentCount: z.number().int().min(GENERATED_PRESET_AGENT_COUNT_MIN).max(GENERATED_PRESET_AGENT_COUNT_MAX),
  language: z.enum(SESSION_LANGUAGES).default("ko"),
  provider: z.string().trim().min(1).max(50),
  model: z.string().trim().min(1).max(120)
});

export type PresetGenerationInput = z.infer<typeof presetGenerationInputSchema>;

export const generatedPresetAgentDraftSchema = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().min(1).max(120),
  goal: z.string().trim().min(1).max(240),
  bias: z.string().trim().min(1).max(240),
  style: z.string().trim().min(1).max(240),
  systemPrompt: z.string().trim().min(20).max(2400)
});

export const generatedPresetDraftSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(240),
  agents: z.array(generatedPresetAgentDraftSchema).min(GENERATED_PRESET_AGENT_COUNT_MIN).max(GENERATED_PRESET_AGENT_COUNT_MAX)
});

export type GeneratedPresetDraft = z.infer<typeof generatedPresetDraftSchema>;

function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

function buildStablePresetId(input: GeneratedPresetDraft): string {
  const slug = slugifySegment(input.name) || "generated-preset";
  const fingerprint = crypto
    .createHash("sha1")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 8);

  return `${CUSTOM_PRESET_ID_PREFIX}${slug}-${fingerprint}`;
}

function buildUniqueAgentKey(label: string, usedKeys: Set<string>): string {
  const base = slugifySegment(label) || "agent";
  let candidate = base;
  let index = 2;

  while (usedKeys.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }

  usedKeys.add(candidate);
  return candidate;
}

export function createPresetFromDraft(input: GeneratedPresetDraft): PresetDefinition {
  const usedKeys = new Set<string>();

  return {
    id: buildStablePresetId(input),
    name: input.name,
    description: input.description,
    agents: input.agents.map((agent) => ({
      key: buildUniqueAgentKey(agent.role || agent.name, usedKeys),
      name: agent.name,
      role: agent.role,
      goal: agent.goal,
      bias: agent.bias,
      style: agent.style,
      systemPrompt: agent.systemPrompt
    }))
  };
}

export function getPresetGenerationLanguageInstruction(language: SessionLanguage): string {
  switch (language) {
    case "ko":
      return "Write the preset name, description, and agent content in Korean.";
    case "ja":
      return "Write the preset name, description, and agent content in Japanese.";
    default:
      return "Write the preset name, description, and agent content in English.";
  }
}
