import { describe, expect, it } from "vitest";
import { z } from "zod";

import { RouteError, withErrorHandler } from "@/app/api/_utils";

describe("api route utils", () => {
  it("returns the original response when the handler succeeds", async () => {
    const handler = withErrorHandler(async () => Response.json({ ok: true }));

    const response = await handler(new Request("http://localhost/test"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("preserves explicit route error status and message", async () => {
    const handler = withErrorHandler(async () => {
      throw new RouteError(404, "Session not found");
    });

    const response = await handler(new Request("http://localhost/test"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Session not found" });
  });

  it("maps zod validation errors to 400", async () => {
    const handler = withErrorHandler(async () => {
      z.object({ name: z.string().min(1) }).parse({ name: "" });
      return Response.json({ ok: true });
    });

    const response = await handler(new Request("http://localhost/test"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("String must contain");
  });

  it("supports route-specific error mapping", async () => {
    const handler = withErrorHandler(
      async () => {
        throw new Error("A run is already in progress");
      },
      {
        fallbackMessage: "Failed to run session",
        mapError(error) {
          const message = error instanceof Error ? error.message : null;
          if (message?.includes("progress")) {
            return { status: 409, message };
          }
          return null;
        }
      }
    );

    const response = await handler(new Request("http://localhost/test"));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "A run is already in progress" });
  });

  it("uses the fallback message for unexpected failures", async () => {
    const handler = withErrorHandler(async () => {
      throw new Error("boom");
    }, { fallbackMessage: "Failed to save settings" });

    const response = await handler(new Request("http://localhost/test"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to save settings" });
  });
});
