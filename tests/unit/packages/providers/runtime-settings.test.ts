import { describe, expect, it, vi } from "vitest";

import type { AppSettings } from "@ship-council/shared";
import { buildOpencodeServerEnv, syncOpenCodeRuntimeSettings } from "@ship-council/providers";

const baseSettings: AppSettings = {
  providerId: "openai",
  modelId: "gpt-5.4",
  authMode: "oauth:1",
  enableMcp: true,
  enableSkills: true,
  updatedAt: "2026-03-24T00:00:00.000Z"
};

describe("OpenCode runtime settings", () => {
  it("disables Claude skills in the OpenCode server env when skills are turned off", () => {
    const env = buildOpencodeServerEnv({}, {
      ...baseSettings,
      enableSkills: false
    });

    expect(env.OPENCODE_DISABLE_CLAUDE_CODE_SKILLS).toBe("1");
  });

  it("applies the global MCP gate by disconnecting servers when disabled", async () => {
    const connect = vi.fn().mockResolvedValue({ error: null, data: true });
    const disconnect = vi.fn().mockResolvedValue({ error: null, data: true });

    await syncOpenCodeRuntimeSettings({
      client: {
        mcp: { connect, disconnect } as never,
        config: {
          get: async () => ({
            error: null,
            data: {
              mcp: {
                github: {
                  type: "local",
                  command: ["npx", "@modelcontextprotocol/server-github"],
                  enabled: true
                }
              }
            }
          }),
          update: vi.fn()
        }
      } as never,
      directory: "/tmp/council",
      settings: {
        ...baseSettings,
        enableMcp: false
      }
    });

    expect(disconnect).toHaveBeenCalledWith({ directory: "/tmp/council", name: "github" });
  });

  it("swallows transient MCP connect/disconnect errors during runtime gating", async () => {
    await expect(
      syncOpenCodeRuntimeSettings({
        client: {
          mcp: {
            disconnect: async () => {
              throw new Error("transient disconnect failure");
            }
          } as never,
          config: {
            get: async () => ({
              error: null,
              data: {
                mcp: {
                  github: {
                    type: "local",
                    command: ["npx", "@modelcontextprotocol/server-github"],
                    enabled: true
                  }
                }
              }
            }),
            update: vi.fn()
          }
        } as never,
        directory: "/tmp/council",
        settings: {
          ...baseSettings,
          enableMcp: false
        }
      })
    ).resolves.toBeUndefined();
  });

  it("preserves per-server MCP enabled flags when the global MCP switch is on", async () => {
    const connect = vi.fn().mockResolvedValue({ error: null, data: true });
    const disconnect = vi.fn().mockResolvedValue({ error: null, data: true });

    await syncOpenCodeRuntimeSettings({
      client: {
        mcp: { connect, disconnect } as never,
        config: {
          get: async () => ({
            error: null,
            data: {
              mcp: {
                github: {
                  type: "local",
                  command: ["npx", "@modelcontextprotocol/server-github"],
                  enabled: false
                },
                notion: {
                  type: "remote",
                  url: "https://mcp.notion.so",
                  enabled: true
                }
              }
            }
          }),
          update: vi.fn()
        }
      } as never,
      directory: "/tmp/council",
      settings: {
        ...baseSettings,
        enableMcp: true
      }
    });

    expect(connect).toHaveBeenCalledWith({ directory: "/tmp/council", name: "notion" });
    expect(disconnect).toHaveBeenCalledWith({ directory: "/tmp/council", name: "github" });
  });

  it("does not rewrite config when global MCP is off and disconnects all servers instead", async () => {
    const connect = vi.fn().mockResolvedValue({ error: null, data: true });
    const disconnect = vi.fn().mockResolvedValue({ error: null, data: true });

    await syncOpenCodeRuntimeSettings({
      client: {
        mcp: { connect, disconnect } as never,
        config: {
          get: async () => ({
            error: null,
            data: {
              mcp: {
                github: {
                  type: "local",
                  command: ["npx", "@modelcontextprotocol/server-github"],
                  enabled: false
                },
                notion: {
                  type: "remote",
                  url: "https://mcp.notion.so",
                  enabled: true
                }
              }
            }
          }),
          update: vi.fn()
        }
      } as never,
      directory: "/tmp/council",
      settings: {
        ...baseSettings,
        enableMcp: false
      }
    });

    expect(disconnect).toHaveBeenCalledWith({ directory: "/tmp/council", name: "github" });
    expect(disconnect).toHaveBeenCalledWith({ directory: "/tmp/council", name: "notion" });
  });
});
