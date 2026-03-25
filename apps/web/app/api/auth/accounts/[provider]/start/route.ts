import { startProviderOauth } from "@pillow-council/providers";
import { appSettingsSchema, saveConnectionSettings } from "@pillow-council/shared";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { authModeId?: string };

    const result = await startProviderOauth(provider, body.authModeId);
    const settings = saveConnectionSettings(
      appSettingsSchema.pick({ providerId: true, authMode: true }).parse({
        providerId: provider,
        authMode: result.authModeId
      })
    );

    return Response.json({
      settings,
      authModeId: result.authModeId,
      ...result.authorization
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to start OpenCode login" },
      { status: 400 }
    );
  }
}
