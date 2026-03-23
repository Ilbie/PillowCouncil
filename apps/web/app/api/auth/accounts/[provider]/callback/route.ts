import { completeProviderOauth } from "@ship-council/providers";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await context.params;
    const body = (await request.json()) as { authModeId?: string; code?: string };

    if (!body.authModeId) {
      return Response.json({ error: "authModeId is required" }, { status: 400 });
    }

    await completeProviderOauth(provider, body.authModeId, body.code);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to complete OpenCode login" },
      { status: 400 }
    );
  }
}
