import { beforeEach, describe, expect, it, vi } from "vitest";

const generatePreset = vi.fn();

class PresetGenerationError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

vi.mock("@ship-council/agents/preset-generation-service", () => ({
  PresetGenerationError,
  generatePreset
}));

describe("POST /api/presets/generate", () => {
  beforeEach(() => {
    generatePreset.mockReset();
  });

  it("delegates preset generation to the agents package and returns the preset", async () => {
    generatePreset.mockResolvedValue({
      id: "custom:test-preset",
      name: "테스트 패널",
      description: "설명",
      agents: []
    });

    const { POST } = await import("../../../../../../apps/web/app/api/presets/generate/route.ts");

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

    expect(generatePreset).toHaveBeenCalledWith({
      prompt: "신규 요금제를 검토할 패널을 만들어줘.",
      agentCount: 2,
      language: "ko",
      provider: "openai",
      model: "gpt-4.1"
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      preset: {
        id: "custom:test-preset",
        name: "테스트 패널",
        description: "설명",
        agents: []
      }
    });
  }, 10000);

  it("maps preset generation domain errors to the declared status code", async () => {
    generatePreset.mockRejectedValue(new PresetGenerationError(400, "Unknown provider"));

    const { POST } = await import("../../../../../../apps/web/app/api/presets/generate/route.ts");

    const response = await POST(
      new Request("http://localhost/api/presets/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "신규 요금제를 검토할 패널을 만들어줘.",
          agentCount: 2,
          language: "ko",
          provider: "missing",
          model: "gpt-4.1"
        })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Unknown provider" });
  });
});
