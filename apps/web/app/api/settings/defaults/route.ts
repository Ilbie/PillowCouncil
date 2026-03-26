import { getDefaultInstallCatalog, installDefaultMcpServer, installDefaultSkill } from "@pillow-council/providers";
import { z } from "zod";

import { withErrorHandler } from "@/app/api/_utils";

export const runtime = "nodejs";

const defaultInstallRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("skill"),
    id: z.string().min(1)
  }),
  z.object({
    kind: z.literal("mcp"),
    id: z.string().min(1)
  })
]);

export async function GET() {
  return Response.json(getDefaultInstallCatalog());
}

export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const payload = defaultInstallRequestSchema.parse(body);

  if (payload.kind === "skill") {
    return Response.json({ skills: await installDefaultSkill(payload.id) });
  }

  return Response.json({ mcp: await installDefaultMcpServer(payload.id) });
}, {
  fallbackMessage: "Failed to install default integration",
  mapError(error) {
    const message = error instanceof Error ? error.message : "Failed to install default integration";
    return { status: 400, message };
  }
});
