import { z } from "zod";

import type { PresetDefinition, ProviderOption } from "@pillow-council/shared";
import {
  createPillowCouncilProvider,
  getProviderOption as defaultGetProviderOption,
  loadProviderCatalog as defaultLoadProviderCatalog,
  type PillowCouncilProvider
} from "@pillow-council/providers";

import { CUSTOM_PRESET_ID_PREFIX } from "./constants";
import {
  createPresetFromDraft,
  generatedPresetAgentDraftSchema,
  getPresetGenerationLanguageInstruction,
  type PresetGenerationInput
} from "./generation";

type PresetGenerationDependencies = {
  createPillowCouncilProvider?: () => Pick<PillowCouncilProvider, "generateJson">;
  loadProviderCatalog?: () => Promise<ProviderOption[]>;
  getProviderOption?: (providerId: string, providers: ProviderOption[]) => ProviderOption | null | undefined;
};

export class PresetGenerationError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "PresetGenerationError";
  }
}

function buildGeneratedPresetSchema(agentCount: number) {
  return z.object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(240),
    agents: z.array(generatedPresetAgentDraftSchema).length(agentCount)
  });
}

function ensureAllowedProvider(
  input: PresetGenerationInput,
  providers: ProviderOption[],
  getProviderOption: (providerId: string, catalog: ProviderOption[]) => ProviderOption | null | undefined
): ProviderOption {
  const provider = getProviderOption(input.provider, providers);
  if (!provider) {
    throw new PresetGenerationError(400, "Unknown provider");
  }

  if (!provider.models.some((model) => model.id === input.model)) {
    throw new PresetGenerationError(400, "Model is not allowed for the selected provider");
  }

  return provider;
}

export async function generatePreset(
  input: PresetGenerationInput,
  dependencies: PresetGenerationDependencies = {}
): Promise<PresetDefinition> {
  const loadProviderCatalog = dependencies.loadProviderCatalog ?? defaultLoadProviderCatalog;
  const getProviderOption = dependencies.getProviderOption ?? defaultGetProviderOption;
  const providerRuntime = (dependencies.createPillowCouncilProvider ?? createPillowCouncilProvider)();
  const catalog = await loadProviderCatalog();

  ensureAllowedProvider(input, catalog, getProviderOption);

  const response = await providerRuntime.generateJson({
    provider: input.provider,
    model: input.model,
    schema: buildGeneratedPresetSchema(input.agentCount),
    retries: 2,
    system: [
      "You design balanced multi-agent debate presets for PillowCouncil.",
      "Create a tight preset that helps a panel make a concrete decision.",
      "Each agent must have a distinct perspective with practical tension between them.",
      "At least one agent should pressure-test assumptions or execution risk.",
      "Avoid duplicate roles or vague generic personas.",
      getPresetGenerationLanguageInstruction(input.language)
    ].join("\n"),
    prompt: [
      `User goal: ${input.prompt}`,
      `Generate exactly ${input.agentCount} agents.`,
      "Return a preset name, a one-sentence description, and the full agent list.",
      "Each systemPrompt must be ready to use as a direct role instruction."
    ].join("\n")
  });

  const preset = createPresetFromDraft(response.data);
  if (!preset.id.startsWith(CUSTOM_PRESET_ID_PREFIX)) {
    throw new PresetGenerationError(500, "Generated preset id must use the custom: namespace");
  }

  return preset;
}
