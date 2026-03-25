import { describe, expect, it } from "vitest";

import { buildAvailablePresets, mergePersistedPresets, resolveCustomPresetForSessionCreate } from "../../../../../apps/web/lib/council-app-helpers";

describe("generated preset persistence helpers", () => {
  it("adds the generated preset back into the available preset list", () => {
    const presets = buildAvailablePresets(
      [{ id: "saas-founder", name: "SaaS Founder", description: "desc", agents: [] }],
      { id: "custom:saas-founder", name: "SaaS Founder", description: "Generated desc", agents: [] }
    );

    expect(presets.map((preset) => preset.id)).toEqual(["saas-founder", "custom:saas-founder"]);
  });

  it("uses the selected custom preset when creating a session after reload", () => {
    expect(
      resolveCustomPresetForSessionCreate({
        presetId: "custom:saas-founder",
        selectedPreset: {
          id: "custom:saas-founder",
          name: "SaaS Founder",
          description: "Generated desc",
          agents: []
        }
      })
    ).toEqual({
      id: "custom:saas-founder",
      name: "SaaS Founder",
      description: "Generated desc",
      agents: []
    });
  });

  it("prefers persisted presets when ids collide during bootstrap", () => {
    expect(
      mergePersistedPresets(
        [{ id: "custom:saas-founder", name: "Old", description: "old", agents: [] }],
        [{ id: "custom:saas-founder", name: "New", description: "new", agents: [] }]
      )
    ).toEqual([{ id: "custom:saas-founder", name: "New", description: "new", agents: [] }]);
  });
});
