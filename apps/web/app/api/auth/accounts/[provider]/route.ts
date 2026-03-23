import { disconnectProviderAuth, getProviderConnection } from "@ship-council/providers";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  try {
    return Response.json(await getProviderConnection(provider));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load provider connection" },
      { status: 502 }
    );
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  try {
    await disconnectProviderAuth(provider);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to remove provider credentials" },
      { status: 400 }
    );
  }
}
