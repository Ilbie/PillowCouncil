import { CUSTOM_PRESET_ID_PREFIX, getPresetDefinition } from "@pillow-council/agents";
import { getProviderOption, loadProviderCatalog } from "@pillow-council/providers";
import { countSessions, createSession, listSessions, sessionCreateInputSchema } from "@pillow-council/shared";
import { getModelThinkingOptions } from "@pillow-council/shared/types";

import { RouteError, withErrorHandler } from "@/app/api/_utils";

export const runtime = "nodejs";

function parsePaginationParam(value: string | null, fallback: number, options: { min: number; max: number }): number {
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new RouteError(400, "Pagination values must be numbers");
  }

  return Math.min(options.max, Math.max(options.min, Math.trunc(parsed)));
}

export const GET = withErrorHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const limit = parsePaginationParam(searchParams.get("limit"), 12, { min: 1, max: 100 });
  const offset = parsePaginationParam(searchParams.get("offset"), 0, { min: 0, max: Number.MAX_SAFE_INTEGER });

  return Response.json({
    items: listSessions({ limit, offset }),
    totalCount: countSessions(),
    limit,
    offset
  });
}, { fallbackMessage: "Failed to load sessions" });

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
