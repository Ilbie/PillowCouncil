import { getMcpSettingsState, mcpSettingsPayloadSchema, saveMcpSettingsState } from "@pillow-council/providers";

import { withErrorHandler } from "@/app/api/_utils";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await getMcpSettingsState());
}

export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const payload = mcpSettingsPayloadSchema.parse(body);
  return Response.json(await saveMcpSettingsState(payload));
}, { fallbackMessage: "Failed to save MCP settings" });
