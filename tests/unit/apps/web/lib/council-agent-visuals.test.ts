import { describe, expect, it } from "vitest";

import { getAgentVisual } from "../../../../../apps/web/lib/council-agent-visuals.ts";

describe("council-agent-visuals", () => {
  it("returns a stable visual for known agent keys", () => {
    const visual = getAgentVisual("pm", "Product Manager");

    expect(visual.color).toContain("blue");
    expect(visual.border).toContain("blue");
  });

  it("falls back to role keywords before hash-based visuals", () => {
    const visual = getAgentVisual("unknown-agent", "보안 담당자");

    expect(visual.color).toContain("emerald");
  });

  it("returns deterministic fallback visuals for unknown keys and roles", () => {
    const first = getAgentVisual("mystery-agent", "Something Else");
    const second = getAgentVisual("mystery-agent", "Something Else");

    expect(second).toEqual(first);
  });
});
