import { beforeEach, describe, expect, it, vi } from "vitest";

const generatePreset = vi.fn();
const saveGeneratedPreset = vi.fn();

class PresetGenerationError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

vi.mock("@ship-council/agents/preset-generation-service", () => ({
  PresetGenerationError,
  generatePreset
}));

vi.mock("@ship-council/shared", async () => {
  const actual = await vi.importActual<typeof import("@ship-council/shared")>("@ship-council/shared");
  return {
    ...actual,
    saveGeneratedPreset
  };
});

describe("POST /api/presets/generate persistence", () => {
  beforeEach(() => {
    generatePreset.mockReset();
    saveGeneratedPreset.mockReset();
  });

  it("persists the generated preset in shared storage before responding", async () => {
    generatePreset.mockResolvedValue({
      id: "custom:test-preset",
      name: "테스트 패널",
      description: "설명",
      agents: []
    });

    const { POST } = await import("../../../../../../apps/web/app/api/presets/generate/route");

    const response = await POST(
      new Request("http://localhost/api/presets/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "신규 요금제를 검토할 패널을 만들어줘.",
          agentCount: 2,
          language: "ko",
          provider: "openai",
          model: "gpt-4.1"
        })
      })
    );

    expect(saveGeneratedPreset).toHaveBeenCalledWith({
      id: "custom:test-preset",
      name: "테스트 패널",
      description: "설명",
      agents: []
    });
    expect(response.status).toBe(200);
  });
});
