import { toExportJson, toMarkdown } from "@pillow-council/exports";
import { getSessionDetail } from "@pillow-council/shared";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const detail = getSessionDetail(id);

  if (!detail) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const format = new URL(request.url).searchParams.get("format") ?? "md";

  if (format === "json") {
    return new Response(toExportJson(detail), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `inline; filename="${detail.session.id}.json"`
      }
    });
  }

  return new Response(toMarkdown(detail), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `inline; filename="${detail.session.id}.md"`
    }
  });
}
