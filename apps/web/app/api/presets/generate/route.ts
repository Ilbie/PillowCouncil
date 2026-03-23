import { createCouncilProvider, getProviderOption, loadProviderCatalog } from "@ship-council/providers";
import {
  createPresetFromDraft,
  generatedPresetAgentDraftSchema,
  getPresetGenerationLanguageInstruction,
  presetGenerationInputSchema
} from "@ship-council/agents/generation";
import { CUSTOM_PRESET_ID_PREFIX } from "@ship-council/agents/constants";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = presetGenerationInputSchema.parse(body);

    const catalog = await loadProviderCatalog();
    const provider = getProviderOption(input.provider, catalog);
    if (!provider) {
      return Response.json({ error: "Unknown provider" }, { status: 400 });
    }

    if (!provider.models.some((model) => model.id === input.model)) {
      return Response.json({ error: "Model is not allowed for the selected provider" }, { status: 400 });
    }

    const providerRuntime = createCouncilProvider();
    const schema = z.object({
      name: z.string().trim().min(1).max(80),
      description: z.string().trim().min(1).max(240),
      agents: z.array(generatedPresetAgentDraftSchema).length(input.agentCount)
    });

    const response = await providerRuntime.generateJson({
      provider: input.provider,
      model: input.model,
      schema,
      retries: 2,
      system: [
        "You design balanced multi-agent debate presets for Ship Council.",
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
      return Response.json({ error: "Generated preset id must use the custom: namespace" }, { status: 500 });
    }

    return Response.json({ preset });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate preset" },
      { status: 400 }
    );
  }
}
