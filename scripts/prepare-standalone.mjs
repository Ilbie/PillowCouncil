import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const webRoot = path.join(root, "apps", "web");
const standaloneAppRoot = path.join(webRoot, ".next", "standalone", "apps", "web");
const standaloneNodeModulesRoot = path.join(webRoot, ".next", "standalone", "node_modules");
const staticRoot = path.join(webRoot, ".next", "static");
const publicRoot = path.join(webRoot, "public");

function copyDirectoryIfPresent(source, target) {
  if (!fs.existsSync(source)) {
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true });
}

if (!fs.existsSync(standaloneAppRoot)) {
  throw new Error(`Standalone app directory not found at ${standaloneAppRoot}. Run the web build first.`);
}

copyDirectoryIfPresent(staticRoot, path.join(standaloneAppRoot, ".next", "static"));
copyDirectoryIfPresent(publicRoot, path.join(standaloneAppRoot, "public"));

fs.rmSync(path.join(standaloneNodeModulesRoot, "better-sqlite3"), { recursive: true, force: true });

if (fs.existsSync(path.join(standaloneNodeModulesRoot, "better-sqlite3"))) {
  throw new Error("better-sqlite3 must not remain inside the standalone node_modules bundle.");
}
