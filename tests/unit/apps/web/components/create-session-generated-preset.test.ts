import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CreateSessionModal } from "../../../../../apps/web/components/council/CreateSessionModal";
import { getUiCopy } from "../../../../../apps/web/lib/i18n";

const copy = getUiCopy("en");
const englishLanguageOption = {
  value: "en" as const,
  label: copy.languages.en.label,
  description: copy.languages.en.description
};

function renderModal() {
  return renderToStaticMarkup(
    React.createElement(CreateSessionModal, {
      copy,
      uiLocale: "en",
      isOpen: true,
      form: {
        title: "",
        prompt: "Evaluate whether this generated preset should stay selected.",
        presetId: "custom:saas-founder",
        model: "gpt-4.1",
        thinkingIntensity: "balanced",
        debateIntensity: 2,
        language: "en",
        enableWebSearch: false
      },
      availablePresets: [
        { id: "saas-founder", name: "SaaS Founder", description: "desc", agents: [] },
        { id: "product-scope", name: "Product Scope", description: "desc", agents: [] }
      ],
      activePreset: null,
      generatedPreset: {
        id: "custom:saas-founder",
        name: "SaaS Founder",
        description: "Generated desc",
        agents: []
      },
      savedProvider: {
        id: "openai",
        label: "OpenAI",
        description: "desc",
        npmPackage: "@ai-sdk/openai",
        connected: true,
        authModes: [],
        models: []
      },
      savedAuthOption: null,
      savedConnectionState: {
        providerId: "openai",
        authModeId: "api:0",
        connected: true,
        available: true
      },
      selectedLanguage: englishLanguageOption,
      selectedDebateIntensityLabel: "2 cycles",
      selectedDebateIntensityDescription: "Run 2 cycles",
      selectedThinkingIntensityLabel: "Balanced",
      selectedThinkingIntensityDescription: "Balanced",
      sessionProvider: {
        id: "openai",
        label: "OpenAI",
        description: "desc",
        npmPackage: "@ai-sdk/openai",
        connected: true,
        authModes: [],
        models: []
      },
      sessionModel: {
        id: "gpt-4.1",
        label: "GPT-4.1",
        description: "Tool calling, web search",
        supportsStructuredOutput: true,
        supportsToolCall: true,
        supportsWebSearch: true
      },
      sessionModelOptions: [
        {
          id: "gpt-4.1",
          label: "GPT-4.1",
          description: "Tool calling, web search",
          supportsStructuredOutput: true,
          supportsToolCall: true,
          supportsWebSearch: true
        }
      ],
      sessionLanguageOptions: [englishLanguageOption],
      thinkingOptions: [{ value: "balanced", label: "Balanced", description: "Balanced" }],
      isConnectionDirty: false,
      isRefreshingModels: false,
      isSubmitting: false,
      onClose: () => undefined,
      onOpenPresetStudio: () => undefined,
      onCreate: () => undefined,
      onFormChange: () => undefined
    })
  );
}

describe("CreateSessionModal generated preset selection", () => {
  it("keeps the generated preset in the dropdown options when selected", () => {
    const markup = renderModal();

    expect(markup).toContain('option value="custom:saas-founder"');
    expect(markup).toContain("SaaS Founder");
  });
});
