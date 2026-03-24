import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { invalidateProviderCatalog, loadProviderCatalog, resetOpencodeForTests, setOpencodeFactoryForTests } from "@ship-council/providers";

describe("provider catalog web search capability", () => {
  beforeEach(() => {
    invalidateProviderCatalog();
    void resetOpencodeForTests();
  });

  afterEach(async () => {
    invalidateProviderCatalog();
    setOpencodeFactoryForTests(null);
    await resetOpencodeForTests();
  });

  it("marks tool-calling models as supporting web search", async () => {
    setOpencodeFactoryForTests(async () => ({
      client: {
        provider: {
          list: async () => ({
            error: null,
            data: {
              connected: [],
              all: [
                {
                  id: "openai",
                  name: "OpenAI",
                  env: ["OPENAI_API_KEY"],
                  models: {
                    "gpt-4.1": {
                      id: "gpt-4.1",
                      name: "GPT-4.1",
                      release_date: "2026-01-01",
                      attachment: false,
                      reasoning: true,
                      toolcall: true,
                      limit: { context: 128000, output: 4096 }
                    },
                    "text-basic": {
                      id: "text-basic",
                      name: "Text Basic",
                      release_date: "2026-01-01",
                      attachment: false,
                      reasoning: false,
                      toolcall: false,
                      limit: { context: 32000, output: 2048 }
                    }
                  }
                }
              ]
            }
          }),
          auth: async () => ({
            error: null,
            data: {
              openai: [{ type: "api", label: "API Key" }]
            }
          })
        }
      } as never,
      server: {
        url: "http://127.0.0.1:1",
        close() {}
      }
    }));

    const catalog = await loadProviderCatalog({ force: true });
    const provider = catalog.find((entry) => entry.id === "openai");

    expect(provider?.models.find((model) => model.id === "gpt-4.1")?.supportsWebSearch).toBe(true);
    expect(provider?.models.find((model) => model.id === "text-basic")?.supportsWebSearch).toBe(false);
  });

  it("keeps GPT-5 family models web-search capable even when toolcall metadata is missing", async () => {
    setOpencodeFactoryForTests(async () => ({
      client: {
        provider: {
          list: async () => ({
            error: null,
            data: {
              connected: [],
              all: [
                {
                  id: "openai",
                  name: "OpenAI",
                  env: ["OPENAI_API_KEY"],
                  models: {
                    "gpt-5.4": {
                      id: "gpt-5.4",
                      name: "GPT-5.4",
                      release_date: "2026-01-01",
                      attachment: false,
                      reasoning: true,
                      limit: { context: 128000, output: 4096 }
                    }
                  }
                }
              ]
            }
          }),
          auth: async () => ({
            error: null,
            data: {
              openai: [{ type: "oauth", label: "ChatGPT Pro/Plus (browser)" }]
            }
          })
        }
      } as never,
      server: {
        url: "http://127.0.0.1:1",
        close() {}
      }
    }));

    const catalog = await loadProviderCatalog({ force: true });
    const provider = catalog.find((entry) => entry.id === "openai");

    expect(provider?.models.find((model) => model.id === "gpt-5.4")?.supportsWebSearch).toBe(true);
  });
});
