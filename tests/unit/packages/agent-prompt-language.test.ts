import { describe, expect, it } from "vitest";

import { PRESET_DEFINITIONS } from "../../../packages/agents/src/presets";
import { formatAgentSystem } from "../../../packages/orchestration/src/prompts";
import type { SessionRecord } from "../../../packages/shared/src/types";

const hasHangul = /[가-힣]/;

function createSession(): SessionRecord {
  return {
    id: "session-language",
    title: "Prompt language",
    prompt: "Evaluate the discussion quality.",
    presetId: "saas-founder",
    customPreset: null,
    provider: "mock-provider",
    model: "mock-model",
    enableWebSearch: false,
    thinkingIntensity: "balanced",
    debateIntensity: 1,
    roundCount: 4,
    language: "ko",
    status: "queued",
    currentRunId: null,
    createdAt: "2026-03-26T00:00:00.000Z",
    updatedAt: "2026-03-26T00:00:00.000Z"
  };
}

describe("built-in agent prompt language", () => {
  it("ships built-in preset metadata and persona prompts in English", () => {
    for (const preset of PRESET_DEFINITIONS) {
      expect(preset.description).not.toMatch(hasHangul);

      for (const agent of preset.agents) {
        expect(agent.role).not.toMatch(hasHangul);
        expect(agent.goal).not.toMatch(hasHangul);
        expect(agent.bias).not.toMatch(hasHangul);
        expect(agent.style).not.toMatch(hasHangul);
        expect(agent.systemPrompt).not.toMatch(hasHangul);
      }
    }
  });

  it("keeps the assembled built-in agent system prompt English", () => {
    const preset = PRESET_DEFINITIONS.find((entry) => entry.id === "saas-founder");
    expect(preset).toBeDefined();

    const prompt = formatAgentSystem(preset!.agents[0], createSession());

    expect(prompt).not.toMatch(hasHangul);
  });
});
