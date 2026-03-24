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

function renderModal(supportsWebSearch: boolean): string {
  return renderToStaticMarkup(
    React.createElement(CreateSessionModal, {
      copy,
      uiLocale: "en",
      isOpen: true,
      form: {
        title: "",
        prompt: "Evaluate whether we should expand the launch.",
        presetId: "saas-founder",
        model: "gpt-4.1",
        thinkingIntensity: "balanced",
        debateIntensity: 2,
        language: "en",
        enableWebSearch: false
      },
      availablePresets: [{ id: "saas-founder", name: "SaaS Founder", description: "desc", agents: [] }],
      activePreset: null,
      generatedPreset: null,
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
        supportsWebSearch
      },
      sessionModelOptions: [{
        id: "gpt-4.1",
        label: "GPT-4.1",
        description: "Tool calling, web search",
        supportsStructuredOutput: true,
        supportsToolCall: true,
        supportsWebSearch
      }],
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

describe("CreateSessionModal web search toggle", () => {
  it("renders the web search toggle for supported models", () => {
    const markup = renderModal(true);

    expect(markup).toContain("Web search");
    expect(markup).toContain('type="checkbox"');
  });

  it("hides the web search toggle for unsupported models", () => {
    const markup = renderModal(false);

    expect(markup).not.toContain("Web search");
  });
});
