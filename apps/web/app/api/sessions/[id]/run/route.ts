import { processSessionRun } from "@pillow-council/orchestration";
import { stopCurrentRun } from "@pillow-council/shared";
import { z } from "zod";

import { withErrorHandler } from "@/app/api/_utils";

export const runtime = "nodejs";

const runRequestSchema = z.object({
  mode: z.enum(["start", "continue"]).default("start")
});

export const POST = withErrorHandler(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const rawBody = await request.text();
  const payload = runRequestSchema.parse(rawBody ? JSON.parse(rawBody) : {});
  const run = await processSessionRun(id, { mode: payload.mode });
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
