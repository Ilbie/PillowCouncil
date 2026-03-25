import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const listSessions = vi.fn(() => []);
const countSessions = vi.fn(() => 0);
const getAppSettings = vi.fn(() => ({
  providerId: "openai",
  modelId: "gpt-4.1",
  authMode: "api:0",
  enableMcp: true,
  enableSkills: true,
  updatedAt: "2026-03-25T00:00:00.000Z"
}));
const listSavedPresets = vi.fn(() => [
  {
    id: "custom:saas-founder",
    name: "SaaS Founder",
    description: "Generated desc",
    agents: []
  }
]);

const loadProviderCatalog = vi.fn(async () => []);
const getDefaultProviderId = vi.fn(() => "openai");
const getDefaultModelId = vi.fn(() => "gpt-4.1");
const getDefaultAuthModeId = vi.fn(() => "api:0");
const getProviderConnectionState = vi.fn(async () => ({
  providerId: "openai",
  authModeId: "api:0",
  connected: true,
  available: true
}));

const councilAppSpy = vi.fn((props: { initialPresets: Array<{ id: string }> }) =>
  React.createElement("div", {
    "data-presets": props.initialPresets.map((preset) => preset.id).join(",")
  })
);

vi.mock("@pillow-council/shared", async () => {
  const actual = await vi.importActual<typeof import("@pillow-council/shared")>("@pillow-council/shared");
  return {
    ...actual,
    listSessions,
    countSessions,
    getAppSettings,
    listSavedPresets
  };
});

vi.mock("@pillow-council/providers", () => ({
  loadProviderCatalog,
  getDefaultProviderId,
  getDefaultModelId,
  getDefaultAuthModeId,
  getProviderConnectionState
}));

vi.mock("@pillow-council/agents", () => ({
  PRESET_DEFINITIONS: [
    { id: "saas-founder", name: "SaaS Founder", description: "desc", agents: [] },
    { id: "product-scope", name: "Product Scope", description: "desc", agents: [] }
  ]
}));

vi.mock("../../../../../apps/web/components/council-app", () => ({
  PillowCouncilApp: councilAppSpy
}));

describe("HomePage saved presets bootstrap", () => {
  it("passes built-in and DB-saved presets into PillowCouncilApp", async () => {
    const { default: HomePage } = await import("../../../../../apps/web/app/page");

    const element = await HomePage();
    const html = renderToStaticMarkup(element);

    expect(councilAppSpy).toHaveBeenCalledTimes(1);
    expect(html).toContain('data-presets="saas-founder,product-scope,custom:saas-founder"');
    expect(loadProviderCatalog).not.toHaveBeenCalled();
    expect(getProviderConnectionState).not.toHaveBeenCalled();
  });
});
