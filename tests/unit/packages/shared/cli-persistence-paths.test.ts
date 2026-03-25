import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { databasePath, setDatabasePathForTests } from "../../../../packages/shared/src/utils";
import { getOpencodeDirectory } from "../../../../packages/providers/src/opencode";
import { getManagedSkillDirectoriesForTests } from "../../../../packages/providers/src/settings-runtime";

describe("CLI persistence paths", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setDatabasePathForTests(null);
  });

  it("stores the SQLite database under the PillowCouncil user-home data directory", () => {
    vi.spyOn(os, "homedir").mockReturnValue("/Users/tester");
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    vi.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);

    expect(databasePath()).toBe(path.join("/Users/tester", ".pillow-council", "data", "pillow-council.db"));
  });

  it("stores OpenCode project files and managed skills under the PillowCouncil user-home directory", () => {
    vi.spyOn(os, "homedir").mockReturnValue("/Users/tester");

    expect(getOpencodeDirectory()).toBe(path.join("/Users/tester", ".pillow-council"));
    expect(getManagedSkillDirectoriesForTests()).toEqual({
      enabled: path.join("/Users/tester", ".pillow-council", "skills"),
      disabled: path.join("/Users/tester", ".pillow-council", "skills-disabled")
    });
  });
});
