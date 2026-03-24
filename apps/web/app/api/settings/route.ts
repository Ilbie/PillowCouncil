import { getProviderOption, loadProviderCatalog, parseAuthModeId } from "@ship-council/providers";
import { appSettingsSchema, getAppSettings, saveAppSettings } from "@ship-council/shared";

import { RouteError, withErrorHandler } from "@/app/api/_utils";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getAppSettings());
}

export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const current = getAppSettings();
  const patch = appSettingsSchema.partial().parse(body);
  const touchesConnectionSettings = patch.providerId !== undefined || patch.modelId !== undefined || patch.authMode !== undefined;
  const settings = appSettingsSchema.parse({
    providerId: patch.providerId ?? current.providerId,
    modelId: patch.modelId ?? current.modelId,
    authMode: patch.authMode ?? current.authMode,
    enableMcp: patch.enableMcp ?? current.enableMcp,
    enableSkills: patch.enableSkills ?? current.enableSkills
  });

  if (!touchesConnectionSettings) {
    return Response.json(saveAppSettings(settings));
  }

  const catalog = await loadProviderCatalog({ force: true });
  const provider = getProviderOption(settings.providerId, catalog);

  if (!provider) {
    throw new RouteError(400, "Unknown provider");
  }

  if (settings.modelId && !provider.models.some((model) => model.id === settings.modelId)) {
    throw new RouteError(400, "Model is not allowed for the selected provider");
  }

  const authMode = provider.authModes.find((item) => item.id === settings.authMode);
  if (!authMode || !parseAuthModeId(settings.authMode)) {
    throw new RouteError(400, "Unknown auth method");
  }

  return Response.json(saveAppSettings(settings));
}, { fallbackMessage: "Failed to save settings" });
