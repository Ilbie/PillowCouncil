import { loadProviderCatalog } from "@ship-council/providers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const force = url.searchParams.has("ts") || url.searchParams.get("refresh") === "true";
    return Response.json(await loadProviderCatalog({ force }));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load provider catalog" },
      { status: 502 }
    );
  }
}
