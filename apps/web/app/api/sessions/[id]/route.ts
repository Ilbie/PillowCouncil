import { getSessionDetail } from "@ship-council/shared";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const detail = getSessionDetail(id);

  if (!detail) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  return Response.json(detail);
}
