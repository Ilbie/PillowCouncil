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
      alias: [
        { find: "@ship-council/shared/types", replacement: fromRoot("packages/shared/src/types.ts") },
        { find: "@ship-council/shared", replacement: fromRoot("packages/shared/src/index.ts") },
        { find: "@ship-council/agents/constants", replacement: fromRoot("packages/agents/src/constants.ts") },
        { find: "@ship-council/agents/generation", replacement: fromRoot("packages/agents/src/generation.ts") },
        { find: "@ship-council/agents/preset-generation-service", replacement: fromRoot("packages/agents/src/preset-generation-service.ts") },
        { find: "@ship-council/agents", replacement: fromRoot("packages/agents/src/index.ts") },
        { find: "@ship-council/providers", replacement: fromRoot("packages/providers/src/index.ts") },
        { find: "@ship-council/orchestration/prompts", replacement: fromRoot("packages/orchestration/src/prompts.ts") },
        { find: "@ship-council/orchestration", replacement: fromRoot("packages/orchestration/src/index.ts") },
        { find: "@ship-council/exports", replacement: fromRoot("packages/exports/src/index.ts") },
        { find: "@", replacement: fromRoot("apps/web") }
      ]
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
