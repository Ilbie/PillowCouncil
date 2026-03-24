import { CUSTOM_PRESET_ID_PREFIX, getPresetDefinition } from "@ship-council/agents";
import { getProviderOption, loadProviderCatalog } from "@ship-council/providers";
import { createSession, listSessions, sessionCreateInputSchema } from "@ship-council/shared";
import { getModelThinkingOptions } from "@ship-council/shared/types";

import { RouteError, withErrorHandler } from "@/app/api/_utils";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listSessions());
}

export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const input = sessionCreateInputSchema.parse(body);

  if (input.customPreset && !input.presetId.startsWith(CUSTOM_PRESET_ID_PREFIX)) {
    throw new RouteError(400, "Custom presets must use a custom: id");
  }

  if (input.customPreset && getPresetDefinition(input.presetId)) {
    throw new RouteError(400, "Custom preset ids cannot shadow built-in presets");
  }

  if (!input.customPreset && !getPresetDefinition(input.presetId)) {
    throw new RouteError(400, "Unknown preset");
  }

  const catalog = await loadProviderCatalog();
  const provider = getProviderOption(input.provider, catalog);
  if (!provider) {
    throw new RouteError(400, "Unknown provider");
  }

  const model = provider.models.find((entry) => entry.id === input.model);
  if (!model) {
    throw new RouteError(400, "Model is not allowed for the selected provider");
  }

  const allowedThinkingValues = new Set(getModelThinkingOptions(model).map((option) => option.value));
  if (!allowedThinkingValues.has(input.thinkingIntensity)) {
    throw new RouteError(400, "Thinking intensity is not allowed for the selected model");
  }

  if (input.enableWebSearch && !model.supportsWebSearch) {
    throw new RouteError(400, "Web search is not allowed for the selected model");
  }

  const session = createSession(input);
  return Response.json({ sessionId: session.id, session });
}, { fallbackMessage: "Failed to create session" });
