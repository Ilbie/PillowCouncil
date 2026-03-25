import { beforeEach, describe, expect, it, vi } from "vitest";

const listSessions = vi.fn();
const countSessions = vi.fn();
const deleteSession = vi.fn();

vi.mock("@pillow-council/shared", async () => {
  const actual = await vi.importActual<typeof import("@pillow-council/shared")>("@pillow-council/shared");
  return {
    ...actual,
    listSessions,
    countSessions,
    deleteSession
  };
});

describe("sessions history routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a paged session payload for load-more requests", async () => {
    const page = [
      {
        session: {
          id: "session_1",
          title: "Session 1",
          prompt: "Keep session history manageable.",
          presetId: "saas-founder",
          customPreset: null,
          provider: "openai",
          model: "gpt-4.1",
          enableWebSearch: false,
          thinkingIntensity: "balanced",
          debateIntensity: 2,
          roundCount: 4,
          language: "en",
          status: "completed",
          currentRunId: null,
          createdAt: "2026-03-25T00:00:00.000Z",
          updatedAt: "2026-03-25T00:00:00.000Z"
        },
        run: null
      }
    ];
    listSessions.mockReturnValue(page);
    countSessions.mockReturnValue(3);

    const { GET } = await import("../../../../../../apps/web/app/api/sessions/route");
    const response = await GET(new Request("http://localhost/api/sessions?limit=1&offset=2"));

    expect(listSessions).toHaveBeenCalledWith({ limit: 1, offset: 2 });
    expect(countSessions).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      items: page,
      totalCount: 3,
      limit: 1,
      offset: 2
    });
  });

  it("deletes a saved session through the session detail route", async () => {
    deleteSession.mockReturnValue(true);

    const route = await import("../../../../../../apps/web/app/api/sessions/[id]/route");
    const response = await route.DELETE(new Request("http://localhost/api/sessions/session_1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "session_1" })
    });

    expect(deleteSession).toHaveBeenCalledWith("session_1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deletedSessionId: "session_1" });
  });

  it("returns a 400 JSON error when pagination params are invalid", async () => {
    const { GET } = await import("../../../../../../apps/web/app/api/sessions/route");
    const response = await GET(new Request("http://localhost/api/sessions?limit=oops"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Pagination values must be numbers"
    });
  });
});
