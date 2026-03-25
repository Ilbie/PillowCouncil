import { describe, expect, it } from "vitest";

import {
  deriveConnectionStateFromProviderOptions,
  shouldRefreshSavedConnectionStateOnMount
} from "../../../../../apps/web/lib/council-app-helpers";

describe("saved connection refresh guard", () => {
  it("skips the mount refresh when the bootstrapped connection already matches the saved provider", () => {
    expect(
      shouldRefreshSavedConnectionStateOnMount({
        providerId: "openai",
        authMode: "oauth:0",
        currentState: {
          providerId: "openai",
          authModeId: "oauth:0",
          connected: true,
          available: true
        }
      })
    ).toBe(false);
  });

  it("requests a refresh when the bootstrapped state is missing or out of date", () => {
    expect(
      shouldRefreshSavedConnectionStateOnMount({
        providerId: "openai",
        authMode: "oauth:0",
        currentState: {
          providerId: "openai",
          authModeId: "api:0",
          connected: false,
          available: false
        }
      })
    ).toBe(true);
  });

  it("derives connection state directly from provider options without another API round trip", () => {
    expect(
      deriveConnectionStateFromProviderOptions([
        {
          id: "openai",
          label: "OpenAI",
          description: "desc",
          npmPackage: "pkg",
          connected: true,
          authModes: [
            {
              id: "oauth:0",
              type: "oauth",
              methodIndex: 0,
              label: "OAuth",
              description: "desc",
              envKeys: []
            }
          ],
          models: []
        }
      ], "openai", "oauth:0")
    ).toEqual({
      providerId: "openai",
      authModeId: "oauth:0",
      connected: true,
      available: true
    });
  });
});
