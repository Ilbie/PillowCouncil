import { listProviderConnections } from "@pillow-council/providers";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json(await listProviderConnections());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load OpenCode connections" },
      { status: 502 }
    );
  }
}
