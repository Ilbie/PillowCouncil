import { describe, expect, it } from "vitest";

import { shouldRefreshSessionListForRunSync } from "../../../../../apps/web/lib/council-app-helpers";

describe("run sync session-list refresh guard", () => {
  it("skips full session list refreshes during active polling", () => {
    expect(shouldRefreshSessionListForRunSync({ source: "poll", isRunning: true })).toBe(false);
  });

  it("still refreshes the session list for manual syncs and finished runs", () => {
    expect(shouldRefreshSessionListForRunSync({ source: "manual", isRunning: true })).toBe(true);
    expect(shouldRefreshSessionListForRunSync({ source: "stream", isRunning: true })).toBe(true);
    expect(shouldRefreshSessionListForRunSync({ source: "poll", isRunning: false })).toBe(true);
  });
});
