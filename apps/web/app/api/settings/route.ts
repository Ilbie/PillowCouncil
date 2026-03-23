import { getProviderOption, loadProviderCatalog, parseAuthModeId } from "@ship-council/providers";
import { appSettingsSchema, getAppSettings, saveAppSettings } from "@ship-council/shared";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getAppSettings());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const current = getAppSettings();
    const patch = appSettingsSchema.partial().parse(body);
    const settings = appSettingsSchema.parse({
      providerId: patch.providerId ?? current.providerId,
      modelId: patch.modelId ?? current.modelId,
      authMode: patch.authMode ?? current.authMode
    });
    const catalog = await loadProviderCatalog({ force: true });
    const provider = getProviderOption(settings.providerId, catalog);

    if (!provider) {
      return Response.json({ error: "Unknown provider" }, { status: 400 });
    }

    if (settings.modelId && !provider.models.some((model) => model.id === settings.modelId)) {
      return Response.json({ error: "Model is not allowed for the selected provider" }, { status: 400 });
    }

    const authMode = provider.authModes.find((item) => item.id === settings.authMode);
    if (!authMode || !parseAuthModeId(settings.authMode)) {
      return Response.json({ error: "Unknown auth method" }, { status: 400 });
    }

    return Response.json(saveAppSettings(settings));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to save settings" },
      { status: 400 }
    );
  }
}
