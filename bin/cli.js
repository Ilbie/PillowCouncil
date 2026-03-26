#!/usr/bin/env node

const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const { spawn } = require("node:child_process");
const http = require("node:http");
const open = require("open");
const { handleStartupFailure, resolveHost } = require("./cli-helpers.cjs");

const HOST = resolveHost(process.env);
const DEFAULT_PORT = Number.parseInt(process.env.PORT || "3000", 10);
const SERVER_READY_TIMEOUT_MS = 20_000;
const shouldOpenBrowser = !process.argv.includes("--no-open");

const PACKAGE_VERSION = require("../package.json").version;
const GITHUB_REPO = "Ilbie/PillowCouncil";
const ASSET_NAME = `pillow-council-standalone-v${PACKAGE_VERSION}.tar.gz`;
const CACHE_DIR = path.join(os.homedir(), ".pillow-council", `v${PACKAGE_VERSION}`);

// ── 캐시된 standalone 서버 경로 탐색 ──────────────────────────────────────
function candidateServerPaths() {
  return [
    path.join(CACHE_DIR, "apps", "web", "server.js"),
    path.join(CACHE_DIR, "server.js"),
  ];
}

function resolveStandaloneServerPath() {
  return candidateServerPaths().find((p) => fs.existsSync(p)) ?? null;
}

// ── HTTPS GET (리다이렉트 처리) ───────────────────────────────────────────
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

// ── GitHub Releases API로 asset URL 조회 ─────────────────────────────────
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
      `GitHub Releases API 오류 (${res.statusCode}): v${PACKAGE_VERSION} 릴리즈를 찾을 수 없습니다.\n` +
      `https://github.com/${GITHUB_REPO}/releases 에서 확인해 주세요.`
    );
  }

  const release = JSON.parse(body);
  const asset = release.assets?.find((a) => a.name === ASSET_NAME);

  if (!asset) {
    throw new Error(
      `릴리즈 v${PACKAGE_VERSION}에서 '${ASSET_NAME}' asset을 찾을 수 없습니다.\n` +
      `https://github.com/${GITHUB_REPO}/releases/tag/v${PACKAGE_VERSION} 에서 확인해 주세요.`
    );
  }

  return asset.browser_download_url;
}

// ── tar.gz 다운로드 + 압축 해제 ──────────────────────────────────────────
async function downloadAndExtract(assetUrl) {
  const tarPath = path.join(os.tmpdir(), ASSET_NAME);

  console.log(`⬇️  standalone 서버 다운로드 중...`);
  const res = await httpsGet(assetUrl);

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tarPath);
    res.pipe(file);
    file.on("finish", resolve);
    file.on("error", reject);
    res.on("error", reject);
  });

  console.log(`📦  압축 해제 중...`);
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  await new Promise((resolve, reject) => {
    const tar = process.platform === "win32" ? "tar" : "tar";
    const child = spawn(tar, ["-xzf", tarPath, "-C", CACHE_DIR], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tar 압축 해제 실패 (exit code ${code})`));
    });
    child.once("error", reject);
  });

  // 임시 파일 정리
  try { fs.unlinkSync(tarPath); } catch { /* 무시 */ }

  console.log(`✅  설치 완료: ${CACHE_DIR}`);
}

// ── standalone 서버 확보 (캐시 or 다운로드) ──────────────────────────────
async function ensureStandaloneServerPath() {
  let serverPath = resolveStandaloneServerPath();
  if (serverPath) return serverPath;

  console.log(`⚙️  PillowCouncil v${PACKAGE_VERSION} standalone 서버를 다운로드합니다...`);

  const assetUrl = await resolveAssetUrl();
  await downloadAndExtract(assetUrl);

  serverPath = resolveStandaloneServerPath();
  if (!serverPath) {
    throw new Error(
      "다운로드 후에도 standalone 서버를 찾을 수 없습니다.\n" +
      `캐시 경로: ${CACHE_DIR}\n` +
      "수동으로 삭제 후 다시 시도해 주세요."
    );
  }

  return serverPath;
}

// ── 포트 탐색 ─────────────────────────────────────────────────────────────
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

// ── 서버 준비 대기 ────────────────────────────────────────────────────────
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

// ── 메인 ──────────────────────────────────────────────────────────────────
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
    console.log(`🪴  PillowCouncil is running at ${url}`);

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
