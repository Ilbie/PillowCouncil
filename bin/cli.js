#!/usr/bin/env node

const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const http = require("node:http");
const open = require("open");
const { handleStartupFailure, resolveHost } = require("./cli-helpers.cjs");

const HOST = resolveHost(process.env);
const DEFAULT_PORT = Number.parseInt(process.env.PORT || "3000", 10);
const SERVER_READY_TIMEOUT_MS = 20_000;
const shouldOpenBrowser = !process.argv.includes("--no-open");

function candidateServerPaths() {
  const packageRoot = path.resolve(__dirname, "..");
  return [
    path.join(packageRoot, "apps", "web", ".next", "standalone", "apps", "web", "server.js"),
    path.join(packageRoot, "apps", "web", ".next", "standalone", "server.js")
  ];
}

function resolveStandaloneServerPath() {
  return candidateServerPaths().find((candidate) => fs.existsSync(candidate)) ?? null;
}

function runNpmCommand(args, cwd) {
  return new Promise((resolve, reject) => {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(npm, args, { cwd, stdio: "inherit", shell: true });
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm ${args.join(" ")} failed with exit code ${code}.`));
    });
    child.once("error", reject);
  });
}

async function runBuild(packageRoot) {
  console.log("⚙️  PillowCouncil standalone server not found. Installing dependencies...");
  await runNpmCommand(["install"], packageRoot);
  console.log("⚙️  Building PillowCouncil (this may take a few minutes)...");
  await runNpmCommand(["run", "build"], packageRoot);
}

async function ensureStandaloneServerPath() {
  const packageRoot = path.resolve(__dirname, "..");
  let serverPath = resolveStandaloneServerPath();

  if (!serverPath) {
    await runBuild(packageRoot);
    serverPath = resolveStandaloneServerPath();
  }

  if (!serverPath) {
    throw new Error(
      "PillowCouncil standalone server was not found even after build. Please check your build output."
    );
  }

  return serverPath;
}

function findAvailablePort(preferredPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
        server.listen(0, HOST);
        return;
      }

      reject(error);
    });

    server.once("listening", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate a local port for PillowCouncil.")));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });

    server.listen(preferredPort, HOST);
  });
}

function waitForServer(url) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const probe = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - startedAt > SERVER_READY_TIMEOUT_MS) {
          reject(new Error(`Timed out waiting for PillowCouncil to start at ${url}.`));
          return;
        }

        setTimeout(probe, 250);
      });
    };

    probe();
  });
}

async function main() {
  const serverPath = await ensureStandaloneServerPath();
  const port = await findAvailablePort(DEFAULT_PORT);
  const url = `http://${HOST}:${port}`;
  const packageRoot = path.resolve(__dirname, "..");

  const child = spawn(process.execPath, [serverPath], {
    cwd: packageRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: HOST,
      PORT: String(port)
    }
  });

  const shutdown = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  child.once("exit", (code) => {
    process.exit(code ?? 0);
  });

  try {
    await waitForServer(url);
    console.log(`PillowCouncil is running at ${url}`);

    if (shouldOpenBrowser) {
      try {
        await open(url);
      } catch (error) {
        console.warn(`Failed to open a browser automatically. Open ${url} manually.`);
        if (error instanceof Error && error.message) {
          console.warn(error.message);
        }
      }
    }
  } catch (error) {
    handleStartupFailure(child, error instanceof Error ? error : new Error(String(error)));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
