import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppSettings = vi.fn();
const saveAppSettings = vi.fn();
const loadProviderCatalog = vi.fn();
const getProviderOption = vi.fn();
const parseAuthModeId = vi.fn();

vi.mock("@ship-council/shared", async () => {
  const actual = await vi.importActual<typeof import("@ship-council/shared")>("@ship-council/shared");

  return {
    ...actual,
    getAppSettings,
    saveAppSettings
  };
});

vi.mock("@ship-council/providers", () => ({
  loadProviderCatalog,
  getProviderOption,
  parseAuthModeId
}));

describe("POST /api/settings", () => {
  beforeEach(() => {
    getAppSettings.mockReset();
    saveAppSettings.mockReset();
    loadProviderCatalog.mockReset();
    getProviderOption.mockReset();
    parseAuthModeId.mockReset();
  });

  it("allows runtime-only saves without a valid provider/auth/model selection", async () => {
    getAppSettings.mockReturnValue({
      providerId: "",
      modelId: "",
      authMode: "",
      enableMcp: true,
      enableSkills: true,
      updatedAt: "2026-03-24T00:00:00.000Z"
    });
    saveAppSettings.mockImplementation((input) => ({ ...input, updatedAt: "2026-03-24T00:00:01.000Z" }));

    const { POST } = await import("../../../../../../apps/web/app/api/settings/route.ts");

    const response = await POST(
      new Request("http://localhost/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enableMcp: false, enableSkills: false })
      })
    );

    expect(response.status).toBe(200);
    expect(loadProviderCatalog).not.toHaveBeenCalled();
    expect(saveAppSettings).toHaveBeenCalledWith({
      providerId: "",
      modelId: "",
      authMode: "",
      enableMcp: false,
      enableSkills: false
    });
  }, 10000);
});
