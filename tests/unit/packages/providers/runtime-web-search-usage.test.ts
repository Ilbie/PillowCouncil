import { describe, expect, it } from "vitest";

import { extractActivityUsageForTests } from "../../../../packages/providers/src/runtime";

describe("provider runtime web search usage accounting", () => {
  it("counts namespaced web-search tool activity as a web search", () => {
    const usage = extractActivityUsageForTests(
      [
        {
          id: "tool-1",
          type: "tool",
          tool: "websearch_web_search_exa",
          state: { status: "completed" }
        }
      ],
      new Set()
    );

    expect(usage.webSearches).toBe(1);
  });

  it("does not count in-progress tool activity", () => {
    const usage = extractActivityUsageForTests(
      [
        {
          id: "tool-1",
          type: "tool",
          tool: "websearch_web_search_exa",
          state: { status: "running" }
        }
      ],
      new Set()
    );

    expect(usage.webSearches).toBe(0);
  });
});
