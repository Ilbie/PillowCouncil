import { CUSTOM_PRESET_ID_PREFIX, getPresetDefinition } from "@ship-council/agents";
import { getProviderOption, loadProviderCatalog } from "@ship-council/providers";
import { createSession, listSessions, sessionCreateInputSchema } from "@ship-council/shared";
import { getModelThinkingOptions } from "@ship-council/shared/types";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listSessions());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = sessionCreateInputSchema.parse(body);

    if (input.customPreset && !input.presetId.startsWith(CUSTOM_PRESET_ID_PREFIX)) {
      return Response.json({ error: "Custom presets must use a custom: id" }, { status: 400 });
    }

    if (input.customPreset && getPresetDefinition(input.presetId)) {
      return Response.json({ error: "Custom preset ids cannot shadow built-in presets" }, { status: 400 });
    }

    if (!input.customPreset && !getPresetDefinition(input.presetId)) {
      return Response.json({ error: "Unknown preset" }, { status: 400 });
    }

    const catalog = await loadProviderCatalog();
    const provider = getProviderOption(input.provider, catalog);
    if (!provider) {
      return Response.json({ error: "Unknown provider" }, { status: 400 });
    }

    const model = provider.models.find((entry) => entry.id === input.model);
    if (!model) {
      return Response.json({ error: "Model is not allowed for the selected provider" }, { status: 400 });
    }

    const allowedThinkingValues = new Set(getModelThinkingOptions(model).map((option) => option.value));
    if (!allowedThinkingValues.has(input.thinkingIntensity)) {
      return Response.json({ error: "Thinking intensity is not allowed for the selected model" }, { status: 400 });
    }

    const session = createSession(input);
    return Response.json({ sessionId: session.id, session });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create session" },
      { status: 400 }
    );
  }
}
