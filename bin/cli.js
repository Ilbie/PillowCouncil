#!/usr/bin/env node

const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const { spawn } = require("node:child_process");
const http = require("node:http");
const { handleStartupFailure, resolveHost } = require("./cli-helpers.cjs");

const HOST = resolveHost(process.env);
const DEFAULT_PORT = Number.parseInt(process.env.PORT || "3000", 10);
const SERVER_READY_TIMEOUT_MS = 20_000;
const shouldOpenBrowser = !process.argv.includes("--no-open");

const PACKAGE_VERSION = require("../package.json").version;
const GITHUB_REPO = "Ilbie/PillowCouncil";
const ASSET_NAME = `pillow-council-standalone-v${PACKAGE_VERSION}.tar.gz`;
const CACHE_DIR = path.join(os.homedir(), ".pillow-council", `v${PACKAGE_VERSION}`);

// ── Cached standalone server path resolution ─────────────────────────────
function candidateServerPaths() {
  return [
    path.join(CACHE_DIR, "apps", "web", "server.js"),
    path.join(CACHE_DIR, "server.js"),
  ];
}

function resolveStandaloneServerPath() {
  return candidateServerPaths().find((p) => fs.existsSync(p)) ?? null;
}

// ── HTTPS GET with redirect handling ─────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "pillow-council-cli" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(httpsGet(res.headers.location));
        return;
      }
      resolve(res);
    });
    req.on("error", reject);
  });
}

// ── Resolve asset download URL from GitHub Releases API ──────────────────
async function resolveAssetUrl() {
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/v${PACKAGE_VERSION}`;
  const res = await httpsGet(apiUrl);

  const body = await new Promise((resolve, reject) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => resolve(data));
    res.on("error", reject);
  });

  if (res.statusCode !== 200) {
    throw new Error(
      `GitHub Releases API error (${res.statusCode}): Could not find release v${PACKAGE_VERSION}.\n` +
      `Please check https://github.com/${GITHUB_REPO}/releases`
    );
  }

  const release = JSON.parse(body);
  const asset = release.assets?.find((a) => a.name === ASSET_NAME);

  if (!asset) {
    throw new Error(
      `Asset '${ASSET_NAME}' not found in release v${PACKAGE_VERSION}.\n` +
      `Please check https://github.com/${GITHUB_REPO}/releases/tag/v${PACKAGE_VERSION}`
    );
  }

  return asset.browser_download_url;
}

// ── Run npm command ──────────────────────────────────────────────────────
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

// ── Download tar.gz and extract ──────────────────────────────────────────
async function downloadAndExtract(assetUrl) {
  const tarPath = path.join(os.tmpdir(), ASSET_NAME);

  console.log("Downloading standalone server...");
  const res = await httpsGet(assetUrl);

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tarPath);
    res.pipe(file);
    file.on("finish", resolve);
    file.on("error", reject);
    res.on("error", reject);
  });

  console.log("Extracting...");
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  await new Promise((resolve, reject) => {
    const child = spawn("tar", ["-xzf", tarPath, "-C", CACHE_DIR], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tar extraction failed (exit code ${code})`));
    });
    child.once("error", reject);
  });

  // Clean up temp file
  try { fs.unlinkSync(tarPath); } catch { /* ignore */ }
}

// ── Install runtime dependencies not bundled in standalone ───────────────
const RUNTIME_DEPS = ["better-sqlite3", "opencode-ai", "@opencode-ai/sdk"];

async function installRuntimeDeps() {
  const marker = path.join(CACHE_DIR, ".runtime-deps-installed");
  if (fs.existsSync(marker)) return;

  console.log("Installing runtime dependencies...");

  // Install in a clean temp directory to avoid workspace package.json issues
  const tmpInstallDir = path.join(os.tmpdir(), `pillow-council-deps-${Date.now()}`);
  fs.mkdirSync(tmpInstallDir, { recursive: true });
  fs.writeFileSync(path.join(tmpInstallDir, "package.json"), '{"private":true}', "utf-8");

  await runNpmCommand(["install", ...RUNTIME_DEPS], tmpInstallDir);

  // Copy each dependency into the standalone node_modules
  const standaloneModules = path.join(CACHE_DIR, "node_modules");
  const tmpModules = path.join(tmpInstallDir, "node_modules");

  for (const dep of fs.readdirSync(tmpModules)) {
    const src = path.join(tmpModules, dep);
    const dest = path.join(standaloneModules, dep);
    if (!fs.existsSync(dest)) {
      fs.cpSync(src, dest, { recursive: true, force: true });
    }
  }

  // Clean up temp directory
  try { fs.rmSync(tmpInstallDir, { recursive: true, force: true }); } catch { /* ignore */ }

  fs.writeFileSync(marker, new Date().toISOString(), "utf-8");
}

// ── Ensure standalone server (cache or download) ─────────────────────────
async function ensureStandaloneServerPath() {
  let serverPath = resolveStandaloneServerPath();

  if (!serverPath) {
    console.log(`PillowCouncil v${PACKAGE_VERSION}: Downloading standalone server...`);

    const assetUrl = await resolveAssetUrl();
    await downloadAndExtract(assetUrl);

    serverPath = resolveStandaloneServerPath();
    if (!serverPath) {
      throw new Error(
        "Standalone server not found after download.\n" +
        `Cache directory: ${CACHE_DIR}\n` +
        "Try deleting the cache directory and running again."
      );
    }
  }

  await installRuntimeDeps();
  console.log("Ready.");

  return serverPath;
}

// ── Find available port ──────────────────────────────────────────────────
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

// ── Wait for server readiness ────────────────────────────────────────────
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

// ── Open browser (ESM-compatible) ────────────────────────────────────────
async function openBrowser(url) {
  try {
    const openModule = await import("open");
    const openFn = openModule.default || openModule;
    await openFn(url);
  } catch (error) {
    console.warn(`Failed to open browser automatically. Open ${url} manually.`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const serverPath = await ensureStandaloneServerPath();
  const port = await findAvailablePort(DEFAULT_PORT);
  const url = `http://${HOST}:${port}`;

  const child = spawn(process.execPath, [serverPath], {
    cwd: CACHE_DIR,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: HOST,
      PORT: String(port),
    },
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
      await openBrowser(url);
    }
  } catch (error) {
    handleStartupFailure(child, error instanceof Error ? error : new Error(String(error)));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
