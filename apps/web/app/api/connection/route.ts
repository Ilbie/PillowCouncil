import { getProviderConnectionState, getProviderOption, loadProviderCatalog, parseAuthModeId, saveApiKeyAuth } from "@ship-council/providers";
import { appSettingsSchema, getAppSettings, saveConnectionSettings } from "@ship-council/shared";
import { z } from "zod";

import { RouteError, withErrorHandler } from "@/app/api/_utils";

export const runtime = "nodejs";

const saveConnectionRequestSchema = z.object({
  providerId: z.string().trim().max(120),
  authMode: z.string().trim().max(120),
  apiKey: z.string().max(2000).default("")
});

export async function GET(request: Request) {
  const settings = getAppSettings();
  const url = new URL(request.url);
  const providerId = url.searchParams.get("providerId") ?? settings.providerId;
  const authModeId = url.searchParams.get("authMode") ?? settings.authMode;
  const force = url.searchParams.get("refresh") === "true";

  return Response.json({
    settings,
    connection: await getProviderConnectionState(providerId, authModeId, { force })
  });
}

export const POST = withErrorHandler(async (request: Request) => {
  const payload = saveConnectionRequestSchema.parse(await request.json());
  const catalog = await loadProviderCatalog({ force: true });
  const provider = getProviderOption(payload.providerId, catalog);

  if (!provider) {
    throw new RouteError(400, "Unknown provider");
  }

  const authMode = provider.authModes.find((item) => item.id === payload.authMode);
  if (!authMode || !parseAuthModeId(payload.authMode)) {
    throw new RouteError(400, "Unknown auth method");
  }

  if (authMode.type === "api" && payload.apiKey.trim()) {
    await saveApiKeyAuth(payload.providerId, payload.authMode, payload.apiKey);
  }

  const settings = saveConnectionSettings(appSettingsSchema.pick({ providerId: true, authMode: true }).parse(payload));

  return Response.json({
    settings,
    connection: await getProviderConnectionState(settings.providerId, settings.authMode)
  });
}, { fallbackMessage: "Failed to save connection" });
