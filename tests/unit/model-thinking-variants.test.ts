import { describe, expect, it } from "vitest";

import {
  sessionCreateInputSchema,
  type ProviderModelOption
} from "@ship-council/shared";
import { toMarkdown } from "@ship-council/exports";
import { getModelThinkingOptions } from "../../packages/shared/src/types";

describe("model-specific thinking variants", () => {
  it("derives thinking options from enabled model variants instead of a fixed global list", () => {
    const model: ProviderModelOption = {
      id: "o4-mini",
      label: "o4-mini",
      description: "reasoning",
      supportsReasoning: true,
      supportsStructuredOutput: true,
      variants: [
        {
          id: "low",
          label: "Low",
          description: "reasoning effort: low",
          reasoningEffort: "low"
        },
        {
          id: "medium",
          label: "Medium",
          description: "reasoning effort: medium",
          reasoningEffort: "medium"
        },
        {
          id: "high",
          label: "High",
          description: "reasoning effort: high",
          reasoningEffort: "high"
        }
      ]
    };

    expect(getModelThinkingOptions(model)).toEqual([
      {
        value: "low",
        label: "Low",
        description: "reasoning effort: low"
      },
      {
        value: "medium",
        label: "Medium",
        description: "reasoning effort: medium"
      },
      {
        value: "high",
        label: "High",
        description: "reasoning effort: high"
      }
    ]);
  });

  it("falls back to one default option when a model exposes no variants", () => {
    const model: ProviderModelOption = {
      id: "claude-sonnet",
      label: "Claude Sonnet",
      description: "reasoning",
      supportsReasoning: true,
      supportsStructuredOutput: true
    };

    expect(getModelThinkingOptions(model)).toEqual([
      {
        value: "balanced",
        label: "Balanced",
        description: "Use the model default reasoning profile."
      }
    ]);
  });

  it("accepts model-specific thinking variant ids in session input and downstream formatting", () => {
    const input = sessionCreateInputSchema.parse({
      prompt: "Ship a model-aware reasoning selector that matches the selected model.",
      presetId: "saas-founder",
      provider: "openai",
      model: "o4-mini",
      thinkingIntensity: "high",
      debateIntensity: 2,
      language: "ko"
    });

    const markdown = toMarkdown({
      session: {
        id: "session_1",
        title: "Variant Session",
        prompt: input.prompt,
        presetId: input.presetId,
        customPreset: null,
        provider: input.provider,
        model: input.model,
        thinkingIntensity: input.thinkingIntensity,
        debateIntensity: input.debateIntensity,
        roundCount: 6,
        language: input.language,
        status: "draft",
        currentRunId: null,
        createdAt: "2026-03-23T00:00:00.000Z",
        updatedAt: "2026-03-23T00:00:00.000Z"
      },
      run: null,
      rounds: [],
      decision: null,
      todos: [],
      usage: {
        totalPromptTokens: 0,
        totalCompletionTokens: 0
      }
    });

    expect(input.thinkingIntensity).toBe("high");
    expect(markdown).toContain("Thinking Intensity: High");
  });
});
