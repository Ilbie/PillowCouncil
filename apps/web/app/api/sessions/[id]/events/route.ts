import { getSession } from "@pillow-council/shared";
import { subscribeToRunStream } from "@pillow-council/orchestration";

export const runtime = "nodejs";

function encodeSseFrame(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = getSession(id);

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let unsubscribe: (() => void) | undefined;
      unsubscribe = subscribeToRunStream(id, (event) => {
        controller.enqueue(encodeSseFrame(event.type, event));
        if (event.type === "run-complete" || event.type === "run-error") {
          unsubscribe?.();
          controller.close();
        }
      });

      request.signal.addEventListener(
        "abort",
        () => {
          unsubscribe();
          controller.close();
        },
        { once: true }
      );
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
