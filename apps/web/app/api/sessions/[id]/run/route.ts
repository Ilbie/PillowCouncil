import { processSessionRun } from "@ship-council/orchestration";
import { stopCurrentRun } from "@ship-council/shared";

export const runtime = "nodejs";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const run = await processSessionRun(id);
    return Response.json({ runId: run.id, run });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run session";
    return Response.json({ error: message }, { status: message.includes("progress") ? 409 : 400 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const run = stopCurrentRun(id);
    return Response.json({ runId: run.id, run });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to stop session";
    return Response.json({ error: message }, { status: message.includes("active run") ? 409 : 400 });
  }
}
