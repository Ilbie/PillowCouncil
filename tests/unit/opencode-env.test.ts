import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@ship-council/shared", () => ({
  workspaceRoot: () => "/tmp/council"
}));

const originalXdgDataHome = process.env.XDG_DATA_HOME;
const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");

afterEach(async () => {
  process.env.XDG_DATA_HOME = originalXdgDataHome;
  if (platformDescriptor) {
    Object.defineProperty(process, "platform", platformDescriptor);
  }
  const { resetOpencodeForTests, setOpencodeFactoryForTests } = await import("../../packages/providers/src/opencode");
  setOpencodeFactoryForTests(null);
  await resetOpencodeForTests();
  vi.resetModules();
});

describe("OpenCode server environment", () => {
  it("uses the shared OpenCode credential store instead of isolating into a ship-council subdirectory", async () => {
    const { buildOpencodeServerEnv } = await import("../../packages/providers/src/opencode");

    const env = buildOpencodeServerEnv({
      XDG_DATA_HOME: "/tmp/opencode-data",
      PATH: "/usr/bin"
    });

    expect(env.XDG_DATA_HOME).toBe("/tmp/opencode-data");
    expect(env.OPENCODE_CONFIG_CONTENT).toBe("{}");
  });

  it("uses the same Windows .local/share auth root that OpenCode uses by default", async () => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32"
    });

    const { buildOpencodeServerEnv } = await import("../../packages/providers/src/opencode");
    const env = buildOpencodeServerEnv({
      APPDATA: "C:\\Users\\ilbie\\AppData\\Roaming",
      USERPROFILE: "C:\\Users\\ilbie"
    });

    expect(env.XDG_DATA_HOME).toBe("C:\\Users\\ilbie\\.local\\share");
  });

  it("restarts the cached OpenCode handle when the configured data-home changes", async () => {
    const { createOpencodeClient } = await import("@opencode-ai/sdk/v2");
    const { getOpencodeHandle, setOpencodeFactoryForTests } = await import("../../packages/providers/src/opencode");
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();
    const factory = vi
      .fn<() => Promise<Awaited<ReturnType<typeof getOpencodeHandle>>>>()
      .mockResolvedValueOnce({
        client: createOpencodeClient({ baseUrl: "http://127.0.0.1:41001" }),
        server: { url: "http://127.0.0.1:41001", close: closeFirst }
      })
      .mockResolvedValueOnce({
        client: createOpencodeClient({ baseUrl: "http://127.0.0.1:41002" }),
        server: { url: "http://127.0.0.1:41002", close: closeSecond }
      });

    setOpencodeFactoryForTests(factory);

    process.env.XDG_DATA_HOME = "/tmp/opencode-a";
    const first = await getOpencodeHandle();

    process.env.XDG_DATA_HOME = "/tmp/opencode-b";
    const second = await getOpencodeHandle();

    expect(factory).toHaveBeenCalledTimes(2);
    expect(first.server.url).toBe("http://127.0.0.1:41001");
    expect(second.server.url).toBe("http://127.0.0.1:41002");
    expect(closeFirst).toHaveBeenCalledTimes(1);
    expect(closeSecond).not.toHaveBeenCalled();
  });

  it("reuses a single replacement handle for concurrent calls during a data-home change", async () => {
    const { createOpencodeClient } = await import("@opencode-ai/sdk/v2");
    const { getOpencodeHandle, setOpencodeFactoryForTests } = await import("../../packages/providers/src/opencode");
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();
    const closeThird = vi.fn();
    const factory = vi
      .fn<() => Promise<Awaited<ReturnType<typeof getOpencodeHandle>>>>()
      .mockResolvedValueOnce({
        client: createOpencodeClient({ baseUrl: "http://127.0.0.1:42001" }),
        server: { url: "http://127.0.0.1:42001", close: closeFirst }
      })
      .mockResolvedValueOnce({
        client: createOpencodeClient({ baseUrl: "http://127.0.0.1:42002" }),
        server: { url: "http://127.0.0.1:42002", close: closeSecond }
      })
      .mockResolvedValueOnce({
        client: createOpencodeClient({ baseUrl: "http://127.0.0.1:42003" }),
        server: { url: "http://127.0.0.1:42003", close: closeThird }
      });

    setOpencodeFactoryForTests(factory);

    process.env.XDG_DATA_HOME = "/tmp/opencode-a";
    await getOpencodeHandle();

    process.env.XDG_DATA_HOME = "/tmp/opencode-b";
    const [secondA, secondB] = await Promise.all([getOpencodeHandle(), getOpencodeHandle()]);

    expect(factory).toHaveBeenCalledTimes(2);
    expect(secondA.server.url).toBe("http://127.0.0.1:42002");
    expect(secondB.server.url).toBe("http://127.0.0.1:42002");
    expect(closeFirst).toHaveBeenCalledTimes(1);
    expect(closeSecond).not.toHaveBeenCalled();
    expect(closeThird).not.toHaveBeenCalled();
  });
});
