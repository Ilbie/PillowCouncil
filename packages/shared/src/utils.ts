import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

let testDatabasePathOverride: string | null = null;

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
    return testDatabasePathOverride;
  }

  return path.resolve(workspaceRoot(), "data", "council.db");
}

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
