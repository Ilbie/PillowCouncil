import { beforeEach, describe, expect, it, vi } from "vitest";

const providerMocks = vi.hoisted(() => ({
  loadProviderCatalog: vi.fn(),
  getProviderOption: vi.fn(),
  parseAuthModeId: vi.fn(),
  saveApiKeyAuth: vi.fn(),
  getProviderConnectionState: vi.fn(),
  startProviderOauth: vi.fn()
}));

const sharedMocks = vi.hoisted(() => ({
  getAppSettings: vi.fn(),
  saveAppSettings: vi.fn(),
  saveConnectionSettings: vi.fn()
}));

vi.mock("@ship-council/providers", () => providerMocks);
vi.mock("@ship-council/shared", async () => {
  const { z } = await import("zod");

  return {
    ...sharedMocks,
    appSettingsSchema: z.object({
      providerId: z.string().trim().max(120).default(""),
      modelId: z.string().trim().max(240).default(""),
      authMode: z.string().trim().max(120).default("")
    })
  };
});

const providerCatalog = [
  {
    id: "openai",
    label: "OpenAI",
    description: "",
    npmPackage: "opencode-ai",
    apiBaseUrl: null,
    docUrl: null,
    connected: true,
    authModes: [
      {
        id: "api:0",
        type: "api" as const,
        methodIndex: 0,
        label: "API key",
        description: "",
        envKeys: [],
        inputLabel: "API Key",
        inputPlaceholder: "sk-...",
        flowKind: "manual" as const
      }
    ],
    models: [{ id: "gpt-4o", label: "GPT-4o", description: "" }]
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description: "",
    npmPackage: "opencode-ai",
    apiBaseUrl: null,
    docUrl: null,
    connected: false,
    authModes: [
      {
        id: "oauth:0",
        type: "oauth" as const,
        methodIndex: 0,
        label: "Browser login",
        description: "",
        envKeys: [],
        inputLabel: null,
        inputPlaceholder: null,
        flowKind: "oauth" as const
      }
    ],
    models: [{ id: "claude-3-7-sonnet", label: "Claude 3.7 Sonnet", description: "" }]
  }
];

describe("auth rewrite regression coverage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    let currentSettings = {
      providerId: "openai",
      modelId: "gpt-4o",
      authMode: "api:0",
      updatedAt: "2026-03-23T00:00:00.000Z"
    };

    providerMocks.loadProviderCatalog.mockResolvedValue(providerCatalog);
    providerMocks.getProviderOption.mockImplementation((providerId: string, options = providerCatalog) =>
      options.find((provider) => provider.id === providerId)
    );
    providerMocks.parseAuthModeId.mockImplementation((value: string) => {
      const match = /^(api|oauth):(\d+)$/.exec(value.trim());
      if (!match) {
        return null;
      }

      return {
        type: match[1],
        methodIndex: Number(match[2])
      };
    });
    providerMocks.getProviderConnectionState.mockImplementation(async (providerId: string, authModeId: string) => ({
      providerId,
      authModeId,
      connected: providerId === "openai" && authModeId === "api:0",
      available: providerCatalog.some(
        (provider) => provider.id === providerId && provider.authModes.some((authMode) => authMode.id === authModeId)
      )
    }));

    sharedMocks.getAppSettings.mockImplementation(() => currentSettings);
    sharedMocks.saveAppSettings.mockImplementation((input: { providerId: string; modelId: string; authMode: string }) => {
      currentSettings = {
        ...input,
        updatedAt: "2026-03-23T00:10:00.000Z"
      };
      return currentSettings;
    });
    sharedMocks.saveConnectionSettings.mockImplementation((input: { providerId: string; authMode: string }) => {
      currentSettings = {
        ...currentSettings,
        providerId: input.providerId,
        authMode: input.authMode,
        updatedAt: "2026-03-23T00:20:00.000Z"
      };
      return currentSettings;
    });
  });

  it("keeps /api/settings merge-safe so partial updates do not wipe modelId", async () => {
    const route = await import("../../apps/web/app/api/settings/route");

    const response = await route.POST(
      new Request("http://localhost/api/settings", {
        method: "POST",
        body: JSON.stringify({
          providerId: "openai"
        })
      })
    );

    const payload = (await response.json()) as { modelId: string };

    expect(response.status).toBe(200);
    expect(payload.modelId).toBe("gpt-4o");
  });

  it("removes auth mutation from /api/settings even when apiKey is present", async () => {
    const route = await import("../../apps/web/app/api/settings/route");

    const response = await route.POST(
      new Request("http://localhost/api/settings", {
        method: "POST",
        body: JSON.stringify({
          providerId: "openai",
          authMode: "api:0",
          apiKey: "sk-test"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(providerMocks.saveApiKeyAuth).not.toHaveBeenCalled();
  });

  it("uses /api/connection to save auth preferences and optional api keys", async () => {
    const route = await import("../../apps/web/app/api/connection/route");

    const response = await route.POST(
      new Request("http://localhost/api/connection", {
        method: "POST",
        body: JSON.stringify({
          providerId: "openai",
          authMode: "api:0",
          apiKey: "sk-test"
        })
      })
    );

    const payload = (await response.json()) as {
      settings: { providerId: string; modelId: string; authMode: string };
      connection: { providerId: string; authModeId: string; connected: boolean; available: boolean };
    };

    expect(response.status).toBe(200);
    expect(sharedMocks.saveConnectionSettings).toHaveBeenCalledWith({
      providerId: "openai",
      authMode: "api:0"
    });
    expect(providerMocks.saveApiKeyAuth).toHaveBeenCalledWith("openai", "api:0", "sk-test");
    expect(payload.settings.modelId).toBe("gpt-4o");
    expect(payload.connection).toEqual({
      providerId: "openai",
      authModeId: "api:0",
      connected: true,
      available: true
    });
  });

  it("persists the selected oauth provider/auth mode when browser login starts", async () => {
    providerMocks.startProviderOauth = vi.fn().mockResolvedValue({
      authModeId: "oauth:0",
      authorization: {
        url: "https://example.com/oauth",
        method: "auto",
        instructions: "Complete authorization in your browser."
      }
    });

    const route = await import("../../apps/web/app/api/auth/accounts/[provider]/start/route");

    const response = await route.POST(
      new Request("http://localhost/api/auth/accounts/anthropic/start", {
        method: "POST",
        body: JSON.stringify({ authModeId: "oauth:0" })
      }),
      { params: Promise.resolve({ provider: "anthropic" }) }
    );

    const payload = (await response.json()) as {
      authModeId: string;
      url: string;
      method: "auto" | "code";
      instructions: string;
      settings?: { providerId: string; authMode: string; modelId: string };
    };

    expect(response.status).toBe(200);
    expect(sharedMocks.saveConnectionSettings).toHaveBeenCalledWith({
      providerId: "anthropic",
      authMode: "oauth:0"
    });
    expect(payload.settings).toMatchObject({
      providerId: "anthropic",
      authMode: "oauth:0",
      modelId: "gpt-4o"
    });
  });
});
