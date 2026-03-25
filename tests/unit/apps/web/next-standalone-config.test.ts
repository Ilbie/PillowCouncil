import { describe, expect, it } from "vitest";

import nextConfig from "../../../../apps/web/next.config";

describe("Next standalone build config", () => {
  it("builds the web app as a standalone server bundle", () => {
    expect(nextConfig.output).toBe("standalone");
  });
});
