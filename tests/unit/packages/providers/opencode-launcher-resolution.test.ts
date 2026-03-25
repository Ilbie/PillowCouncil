import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveOpencodeLauncherPathForTests } from "../../../../packages/providers/src/opencode";

describe("OpenCode launcher resolution", () => {
  it("resolves the launcher from the installed opencode-ai package location", () => {
    const launcherPath = resolveOpencodeLauncherPathForTests(
      () => path.join("/opt/npm", "node_modules", "opencode-ai", "package.json"),
      () => true
    );

    expect(launcherPath).toBe(path.join("/opt/npm", "node_modules", "opencode-ai", "bin", "opencode"));
  });
});
