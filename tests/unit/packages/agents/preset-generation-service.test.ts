import { describe, expect, it, vi } from "vitest";

import type { PresetDefinition, ProviderOption } from "@ship-council/shared";
import { CUSTOM_PRESET_ID_PREFIX } from "@ship-council/agents/constants";
import type { PresetGenerationInput } from "@ship-council/agents/generation";

type PresetGenerationDependencies = {
  createCouncilProvider: () => {
    generateJson: (input: unknown) => Promise<{ data: unknown }>;
  };
  loadProviderCatalog: () => Promise<ProviderOption[]>;
  getProviderOption: (providerId: string, providers: ProviderOption[]) => ProviderOption | null;
};

type GeneratePresetFn = (
  input: PresetGenerationInput,
  dependencies?: PresetGenerationDependencies
) => Promise<PresetDefinition>;

function isGeneratePresetFunction(value: unknown): value is GeneratePresetFn {
  return typeof value === "function";
}

const validInput: PresetGenerationInput = {
  prompt: "전자상거래 팀의 신규 결제 도입 우선순위를 정리해줘.",
  agentCount: 2,
  language: "ko",
  provider: "openai",
  model: "gpt-4.1"
};

const catalog: ProviderOption[] = [
  {
    id: "openai",
    label: "OpenAI",
    description: "OpenAI provider",
    npmPackage: "@ai-sdk/openai",
    connected: true,
    authModes: [],
    models: [
      {
        id: "gpt-4.1",
        label: "GPT-4.1",
        description: "Reasoning-capable model",
        family: "gpt-4.1",
        contextWindow: 128000,
        supportsReasoning: true,
        supportsToolCall: true,
        supportsStructuredOutput: true,
        variants: []
      }
    ]
  }
];

describe("generatePreset", () => {
  it("delegates provider validation and returns a custom preset", async () => {
    const agentsModule = await import("@ship-council/agents/preset-generation-service");
    const generatePreset = Reflect.get(agentsModule, "generatePreset");

    expect(generatePreset).toBeTypeOf("function");
    if (!isGeneratePresetFunction(generatePreset)) {
      throw new Error("generatePreset export is missing");
    }

    const generateJson = vi.fn().mockResolvedValue({
      data: {
        name: "결제 패널",
        description: "결제 도입 결정을 돕는 패널",
        agents: [
          {
            name: "제품 리드",
            role: "제품 전략가",
            goal: "도입 우선순위를 정리한다",
            bias: "고객 가치 중심",
            style: "명확하고 압축적",
            systemPrompt: "제품 전략 관점에서 결제 도입 우선순위를 평가하라."
          },
          {
            name: "리스크 리뷰어",
            role: "운영 리스크 검토자",
            goal: "운영 리스크를 압박한다",
            bias: "실패 비용 최소화",
            style: "비판적이고 실무적",
            systemPrompt: "운영 리스크와 장애 비용을 중심으로 계획을 반박하라."
          }
        ]
      }
    });

    const preset = await generatePreset(validInput, {
      createCouncilProvider: () => ({ generateJson } as never),
      loadProviderCatalog: async () => catalog,
      getProviderOption: (providerId, providers) => providers.find((provider) => provider.id === providerId) ?? null
    });

    expect(generateJson).toHaveBeenCalledTimes(1);
    expect(generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: validInput.provider,
        model: validInput.model,
        retries: 2
      })
    );
    expect(preset.id.startsWith(CUSTOM_PRESET_ID_PREFIX)).toBe(true);
    expect(preset.agents).toHaveLength(2);
  }, 10000);

  it("rejects models that are not allowed for the selected provider", async () => {
    const agentsModule = await import("@ship-council/agents/preset-generation-service");
    const generatePreset = Reflect.get(agentsModule, "generatePreset");

    expect(generatePreset).toBeTypeOf("function");
    if (!isGeneratePresetFunction(generatePreset)) {
      throw new Error("generatePreset export is missing");
    }

    await expect(
      generatePreset(
        { ...validInput, model: "not-allowed" },
        {
          createCouncilProvider: () => ({ generateJson: vi.fn() } as never),
          loadProviderCatalog: async () => catalog,
          getProviderOption: (providerId, providers) => providers.find((provider) => provider.id === providerId) ?? null
        }
      )
    ).rejects.toThrow("Model is not allowed for the selected provider");
  });
});
