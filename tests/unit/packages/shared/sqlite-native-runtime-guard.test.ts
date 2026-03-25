import { describe, expect, it } from "vitest";

import { createBetterSqliteLoadErrorForTests } from "../../../../packages/shared/src/db";

describe("better-sqlite3 runtime guidance", () => {
  it("rewrites native loader failures into actionable Windows/WSL rebuild guidance", () => {
    const original = new Error(
      String.raw`\\?\C:\Users\ilbie\Desktop\Council\node_modules\better-sqlite3\build\Release\better_sqlite3.node is not a valid Win32 application.`
    ) as NodeJS.ErrnoException;
    original.code = "ERR_DLOPEN_FAILED";

    const rewritten = createBetterSqliteLoadErrorForTests(original);

    expect(rewritten.message).toContain("better-sqlite3 native bindings do not match the current runtime");
    expect(rewritten.message).toContain("npm run native:rebuild");
    expect(rewritten.message).toContain("Windows and WSL/Linux cannot safely share the same built better-sqlite3 binary");
  });

  it("rewrites invalid ELF header failures into the same mixed-runtime guidance", () => {
    const original = new Error(
      "/mnt/c/Users/ilbie/Desktop/Council/node_modules/better-sqlite3/build/Release/better_sqlite3.node: invalid ELF header"
    ) as NodeJS.ErrnoException;
    original.code = "ERR_DLOPEN_FAILED";

    const rewritten = createBetterSqliteLoadErrorForTests(original);

    expect(rewritten.message).toContain("better-sqlite3 native bindings do not match the current runtime");
    expect(rewritten.message).toContain("npm run native:rebuild");
  });

  it("preserves unrelated dlopen failures without over-claiming a Windows/WSL mismatch", () => {
    const original = new Error("Module did not self-register") as NodeJS.ErrnoException;
    original.code = "ERR_DLOPEN_FAILED";

    const rewritten = createBetterSqliteLoadErrorForTests(original);

    expect(rewritten).toBe(original);
  });
});
