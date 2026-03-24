import { describe, expect, it } from "vitest";

import { appSettingsSchema } from "@ship-council/shared";

describe("app settings schema", () => {
  it("defaults MCP and skills toggles to enabled", () => {
    expect(appSettingsSchema.parse({})).toMatchObject({
      providerId: "",
      modelId: "",
      authMode: "",
      enableMcp: true,
      enableSkills: true
    });
  });
});
