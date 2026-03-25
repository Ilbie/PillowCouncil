import { describe, expect, it } from "vitest";

import { presetGenerationInputSchema } from "../../../packages/agents/src/generation";
import { sessionCreateInputSchema } from "../../../packages/shared/src/types";

describe("default language baselines", () => {
  it("preserves Korean as the session-language default when omitted", () => {
    const parsed = sessionCreateInputSchema.parse({
      prompt: "Evaluate whether the council should default its prompts to English.",
      presetId: "saas-founder",
      provider: "openai",
      model: "gpt-4.1"
    });

    expect(parsed.language).toBe("ko");
  });

  it("preserves Korean as the generated-preset language default when omitted", () => {
    const parsed = presetGenerationInputSchema.parse({
      prompt: "Build a panel for evaluating a macroeconomic risk scenario.",
      agentCount: 3,
      provider: "openai",
      model: "gpt-4.1"
    });

    expect(parsed.language).toBe("ko");
  });

  it("preserves explicit non-English language choices", () => {
    const session = sessionCreateInputSchema.parse({
      prompt: "한국어로 토론을 진행해야 하는 경우를 평가해줘.",
      presetId: "saas-founder",
      provider: "openai",
      model: "gpt-4.1",
      language: "ko"
    });
    const preset = presetGenerationInputSchema.parse({
      prompt: "日本語でプリセットを生成するケースを考える。",
      agentCount: 3,
      provider: "openai",
      model: "gpt-4.1",
      language: "ja"
    });

    expect(session.language).toBe("ko");
    expect(preset.language).toBe("ja");
  });
});
