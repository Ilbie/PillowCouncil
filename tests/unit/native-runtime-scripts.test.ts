import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};

describe("native module recovery scripts", () => {
  it("exposes a native rebuild script for the current runtime", () => {
    expect(packageJson.scripts).toEqual(
      expect.objectContaining({
        "native:rebuild": "npm rebuild better-sqlite3"
      })
    );
  });
});
