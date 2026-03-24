import { getSessionDetail } from "@ship-council/shared";

import { RouteError, withErrorHandler } from "@/app/api/_utils";

export const runtime = "nodejs";

export const GET = withErrorHandler(async (_: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const detail = getSessionDetail(id);

  if (!detail) {
    throw new RouteError(404, "Session not found");
  }

  return Response.json(detail);
}, { fallbackMessage: "Failed to load session" });
