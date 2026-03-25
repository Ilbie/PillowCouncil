import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")) as {
  private?: boolean;
  bin?: Record<string, string>;
  files?: string[];
};

describe("CLI package manifest", () => {
  it("exposes the pillow-council executable for npm global installs and npx", () => {
    expect(packageJson.private).toBe(false);
    expect(packageJson.bin).toEqual({
      "pillow-council": "bin/cli.js"
    });
  });

  it("publishes only the runtime artifacts needed by the packaged CLI", () => {
    expect(packageJson.files).toEqual(expect.arrayContaining([
      "bin",
      "apps/web/.next/standalone",
      "apps/web/.next/static"
    ]));
  });
});
