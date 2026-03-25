import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import net from "node:net";
import path from "node:path";

import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk/v2";
import { getAppSettings, getDefaultAppSettings, type AppSettings, workspaceRoot } from "@ship-council/shared";

type OpencodeHandle = {
  client: OpencodeClient;
  server: {
    url: string;
    close(): void;
  };
};

type CachedOpencodeHandle = {
  cacheKey: string;
  promise: Promise<OpencodeHandle>;
};

let cachedHandle: CachedOpencodeHandle | null = null;
let factory: (() => Promise<OpencodeHandle>) | null = null;
let handleMutationLock: Promise<void> = Promise.resolve();

function getDefaultDataHomeRoot(env: NodeJS.ProcessEnv = process.env): string {
  const userHome = env.USERPROFILE?.trim() || env.HOME?.trim() || os.homedir();

  if (process.platform === "darwin") {
    return path.join(userHome, "Library", "Application Support");
  }

  if (process.platform === "win32") {
    return path.win32.join(userHome, ".local", "share");
  }

  return env.XDG_DATA_HOME?.trim() || path.join(userHome, ".local", "share");
}

export function getOpenCodeDataHomeRoot(env: NodeJS.ProcessEnv = process.env): string {
  const xdgDataHome = env.XDG_DATA_HOME?.trim();
  if (xdgDataHome) {
    return xdgDataHome;
  }

  return getDefaultDataHomeRoot(env);
}

export function buildOpencodeServerEnv(
  env: NodeJS.ProcessEnv = process.env,
  settings: AppSettings = getSafeAppSettings()
): NodeJS.ProcessEnv {
  return {
    ...env,
    XDG_DATA_HOME: getOpenCodeDataHomeRoot(env),
    OPENCODE_CONFIG_CONTENT: JSON.stringify({}),
    OPENCODE_ENABLE_EXA: "1",
    OPENCODE_DISABLE_CLAUDE_CODE_SKILLS: settings.enableSkills ? "0" : "1"
  };
}

function getSafeAppSettings(): AppSettings {
  try {
    return getAppSettings();
  } catch {
    return getDefaultAppSettings();
  }
}

function getOpencodeHandleCacheKey(env: NodeJS.ProcessEnv = process.env): string {
  const settings = getSafeAppSettings();
  const serverEnv = buildOpencodeServerEnv(env, settings);

  return JSON.stringify({
    directory: getOpencodeDirectory(),
    xdgDataHome: serverEnv.XDG_DATA_HOME ?? "",
    configContent: serverEnv.OPENCODE_CONFIG_CONTENT ?? "",
    exaEnabled: serverEnv.OPENCODE_ENABLE_EXA ?? "",
    skillsDisabled: serverEnv.OPENCODE_DISABLE_CLAUDE_CODE_SKILLS ?? ""
  });
}

export function getOpencodeDirectory(): string {
  return workspaceRoot();
}

function getOpencodeLauncherPath(): string {
  const root = workspaceRoot();
  const launcherPath = path.join(root, "node_modules", "opencode-ai", "bin", "opencode");
  if (!existsSync(launcherPath)) {
    throw new Error("OpenCode launcher was not found in node_modules. Run `npm install` to install opencode-ai first.");
  }

  return launcherPath;
}

async function startOpencodeServer(): Promise<OpencodeHandle["server"]> {
  const launcherPath = getOpencodeLauncherPath();
  const root = workspaceRoot();
  const hostname = "127.0.0.1";
  const port = await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, hostname, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate an OpenCode server port.")));
        return;
      }

      const availablePort = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(availablePort);
      });
    });
  });
  const timeout = 15_000;
  const proc = spawn(process.execPath, [launcherPath, "serve", `--hostname=${hostname}`, `--port=${port}`], {
    cwd: root,
    windowsHide: true,
    env: buildOpencodeServerEnv()
  });

  const url = await new Promise<string>((resolve, reject) => {
    const id = setTimeout(() => {
      reject(new Error(`Timeout waiting for OpenCode server to start after ${timeout}ms`));
    }, timeout);
    let output = "";

    const onData = (chunk: unknown) => {
      output += chunk instanceof Buffer ? chunk.toString() : String(chunk);
      const lines = output.split("\n");

      for (const line of lines) {
        if (!line.startsWith("opencode server listening")) {
          continue;
        }

        const match = line.match(/on\s+(https?:\/\/[^\s]+)/);
        if (!match) {
          clearTimeout(id);
          reject(new Error(`Failed to parse OpenCode server URL from output: ${line}`));
          return;
        }

        clearTimeout(id);
        resolve(match[1]);
        return;
      }
    };

    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);
    proc.on("exit", (code) => {
      clearTimeout(id);
      let message = `OpenCode server exited with code ${code}`;
      if (output.trim()) {
        message += `\nOpenCode output: ${output}`;
      }
      reject(new Error(message));
    });
    proc.on("error", (error) => {
      clearTimeout(id);
      reject(error);
    });
  });

  return {
    url,
    close() {
      proc.kill();
    }
  };
}

async function disposeCachedHandle(): Promise<void> {
  if (!cachedHandle) {
    return;
  }

  const activeHandle = cachedHandle;
  cachedHandle = null;
  const resolvedHandle = await activeHandle.promise.catch(() => null);
  resolvedHandle?.server.close();
}

export async function disposeOpencodeHandle(): Promise<void> {
  await disposeCachedHandle();
}

async function withOpencodeHandleLock<T>(action: () => Promise<T>): Promise<T> {
  const previousLock = handleMutationLock;
  let releaseLock: () => void = () => undefined;
  handleMutationLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  await previousLock;

  try {
    return await action();
  } finally {
    releaseLock();
  }
}

export async function getOpencodeHandle(): Promise<OpencodeHandle> {
  return withOpencodeHandleLock(async () => {
    const cacheKey = getOpencodeHandleCacheKey();

    if (cachedHandle?.cacheKey === cacheKey) {
      return cachedHandle.promise;
    }

    if (cachedHandle) {
      await disposeCachedHandle();
    }

    const activeFactory =
      factory ??
      (async () => {
        const server = await startOpencodeServer();
        const client = createOpencodeClient({
          baseUrl: server.url
        });

        return {
          client,
          server
        };
      });

    let promise: Promise<OpencodeHandle>;
    promise = activeFactory().catch((error) => {
      if (cachedHandle?.promise === promise) {
        cachedHandle = null;
      }

      throw error;
    });

    cachedHandle = {
      cacheKey,
      promise
    };

    return promise;
  });
}

export async function getOpencodeClient(): Promise<OpencodeClient> {
  const handle = await getOpencodeHandle();
  return handle.client;
}

export async function resetOpencodeForTests(): Promise<void> {
  await disposeCachedHandle();
  factory = null;
}

export function setOpencodeFactoryForTests(nextFactory: (() => Promise<OpencodeHandle>) | null): void {
  factory = nextFactory;
  cachedHandle = null;
}
