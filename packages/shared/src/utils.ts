import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";

let testDatabasePathOverride: string | null = null;

export function getPillowCouncilHomeDir(homeDir = os.homedir()): string {
  return path.join(homeDir, ".pillow-council");
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function workspaceRoot(fromDir = process.cwd()): string {
  let current = path.resolve(fromDir);

  while (true) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml")) || fs.existsSync(path.join(current, "package.json"))) {
      if (fs.existsSync(path.join(current, "packages")) && fs.existsSync(path.join(current, "apps"))) {
        return current;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return process.cwd();
    }
    current = parent;
  }
}

export function databasePath(): string {
  if (testDatabasePathOverride) {
    migrateLegacyDatabasePath(testDatabasePathOverride);
    return testDatabasePathOverride;
  }

  const filePath = path.join(getPillowCouncilHomeDir(), "data", "pillow-council.db");
  migrateLegacyDatabasePath(filePath);
  return filePath;
}

function migrateLegacyDatabasePath(targetPath: string): void {
  const legacyPaths = new Set<string>([
    targetPath.endsWith("pillow-council.db") ? targetPath.replace(/pillow-council\.db$/, "council.db") : targetPath,
    path.resolve(workspaceRoot(), "data", "pillow-council.db"),
    path.resolve(workspaceRoot(), "data", "council.db")
  ]);

  if (fs.existsSync(targetPath)) {
    return;
  }

  for (const legacyPath of legacyPaths) {
    if (legacyPath === targetPath || !fs.existsSync(legacyPath)) {
      continue;
    }

    migrateDatabaseFamily(legacyPath, targetPath);
    return;
  }
}

function migrateDatabaseFamily(sourcePath: string, targetPath: string): void {
  const suffixes = ["", "-shm", "-wal"];

  for (const suffix of suffixes) {
    const source = `${sourcePath}${suffix}`;
    const target = `${targetPath}${suffix}`;

    if (!fs.existsSync(source) || fs.existsSync(target)) {
      continue;
    }

    ensureParentDirectory(target);

    try {
      fs.renameSync(source, target);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EXDEV") {
        throw error;
      }

      fs.copyFileSync(source, target);
      fs.unlinkSync(source);
    }
  }
}

export const migrateDatabaseFamilyForTests = migrateDatabaseFamily;

export function setDatabasePathForTests(filePath: string | null): void {
  testDatabasePathOverride = filePath;
}

export function ensureParentDirectory(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function serializeList(values: string[]): string {
  return JSON.stringify(values);
}

export function parseList(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
