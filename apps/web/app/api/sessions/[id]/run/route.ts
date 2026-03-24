import { processSessionRun } from "@ship-council/orchestration";
import { stopCurrentRun } from "@ship-council/shared";

import { withErrorHandler } from "@/app/api/_utils";

export const runtime = "nodejs";

export const POST = withErrorHandler(async (_: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const run = await processSessionRun(id);
  return Response.json({ runId: run.id, run });
}, {
  fallbackMessage: "Failed to run session",
  mapError(error) {
    const message = error instanceof Error ? error.message : "Failed to run session";
    return { status: message.includes("progress") ? 409 : 400, message };
  }
});

export const DELETE = withErrorHandler(async (_: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const run = stopCurrentRun(id);
  return Response.json({ runId: run.id, run });
}, {
  fallbackMessage: "Failed to stop session",
  mapError(error) {
    const message = error instanceof Error ? error.message : "Failed to stop session";
    return { status: message.includes("active run") ? 409 : 400, message };
  }
});
