import { beforeEach, describe, expect, it, vi } from "vitest";

const getMcpSettingsState = vi.fn();
const saveMcpSettingsState = vi.fn();

vi.mock("@ship-council/providers", async () => {
  const actual = await vi.importActual<typeof import("@ship-council/providers")>("@ship-council/providers");

  return {
    ...actual,
    getMcpSettingsState,
    saveMcpSettingsState
  };
});

describe("/api/settings/mcp", () => {
  const routeModulePath = "../../../../../../apps/web/app/api/settings/mcp/route" + ".ts";

  beforeEach(() => {
    getMcpSettingsState.mockReset();
    saveMcpSettingsState.mockReset();
  });

  it("returns the MCP tab state", async () => {
    getMcpSettingsState.mockResolvedValue({
      enabled: true,
      servers: [
        {
          name: "github",
          enabled: true,
          type: "local",
          command: ["npx", "@modelcontextprotocol/server-github"],
          status: "connected",
          resourceCount: 3
        }
      ]
    });

    const { GET } = await import(routeModulePath);
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      enabled: true,
      servers: [
        {
          name: "github",
          enabled: true,
          type: "local",
          command: ["npx", "@modelcontextprotocol/server-github"],
          status: "connected",
          resourceCount: 3
        }
      ]
    });
  }, 10000);

  it("saves the MCP tab state", async () => {
    saveMcpSettingsState.mockResolvedValue({ enabled: false, servers: [] });

    const { POST } = await import(routeModulePath);
    const response = await POST(
      new Request("http://localhost/api/settings/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false, servers: [] })
      })
    );

    expect(saveMcpSettingsState).toHaveBeenCalledWith({ enabled: false, servers: [] });
    expect(response.status).toBe(200);
  }, 10000);

  it("disconnects removed MCP servers during save", async () => {
    saveMcpSettingsState.mockResolvedValue({ enabled: true, servers: [] });

    const { POST } = await import(routeModulePath);
    await POST(
      new Request("http://localhost/api/settings/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: true, servers: [] })
      })
    );

    expect(saveMcpSettingsState).toHaveBeenCalledWith({ enabled: true, servers: [] });
  }, 10000);
});
