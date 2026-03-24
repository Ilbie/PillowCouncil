import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OpenCodeCouncilProvider,
  invalidateProviderCatalog,
  resetOpencodeForTests,
  setOpencodeFactoryForTests
} from "@ship-council/providers";

describe("OpenCodeCouncilProvider web search", () => {
  beforeEach(() => {
    invalidateProviderCatalog();
    void resetOpencodeForTests();
  });

  afterEach(async () => {
    invalidateProviderCatalog();
    setOpencodeFactoryForTests(null);
    await resetOpencodeForTests();
  });

  it("passes the websearch tool only when enabled", async () => {
    const prompt = vi.fn().mockResolvedValue({
      error: null,
      data: {
        info: {
          id: "msg-1",
          tokens: { input: 10, output: 20 },
          error: null,
          structured: undefined
        },
        parts: [{ type: "text", text: "hello" }]
      }
    });

    setOpencodeFactoryForTests(async () => ({
      client: {
        provider: {
          list: async () => ({
            error: null,
            data: {
              connected: ["openai"],
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
        },
        session: {
          create: async () => ({ error: null, data: { id: "session-1" } }),
          prompt,
          delete: async () => ({ error: null, data: true })
        }
      } as never,
      server: {
        url: "http://127.0.0.1:1",
        close() {}
      }
    }));

    const provider = new OpenCodeCouncilProvider();

    await provider.generateText({
      provider: "openai",
      model: "gpt-4.1",
      system: "System prompt",
      prompt: "User prompt",
      enableWebSearch: true
    });

    await provider.generateText({
      provider: "openai",
      model: "gpt-4.1",
      system: "System prompt",
      prompt: "User prompt"
    });

    expect(prompt).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tools: { websearch: true }
      })
    );
    expect(prompt).toHaveBeenNthCalledWith(
      2,
      expect.not.objectContaining({
        tools: expect.anything()
      })
    );
  });
});
