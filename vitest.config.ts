import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const fromRoot = (target: string) => path.resolve(currentDir, target);

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react"
  },
  resolve: {
      alias: {
        "@": fromRoot("apps/web"),
        "@ship-council/shared": fromRoot("packages/shared/src/index.ts"),
        "@ship-council/shared/*": fromRoot("packages/shared/src/*"),
        "@ship-council/agents": fromRoot("packages/agents/src/index.ts"),
        "@ship-council/agents/constants": fromRoot("packages/agents/src/constants.ts"),
        "@ship-council/agents/generation": fromRoot("packages/agents/src/generation.ts"),
        "@ship-council/providers": fromRoot("packages/providers/src/index.ts"),
        "@ship-council/providers/*": fromRoot("packages/providers/src/*"),
        "@ship-council/orchestration": fromRoot("packages/orchestration/src/index.ts"),
        "@ship-council/orchestration/*": fromRoot("packages/orchestration/src/*"),
        "@ship-council/exports": fromRoot("packages/exports/src/index.ts")
      }
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
