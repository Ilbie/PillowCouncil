import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), "data", "test-e2e.db");

for (const candidate of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
  if (fs.existsSync(candidate)) {
    fs.rmSync(candidate, { force: true });
  }
}

console.log(`[reset-db] removed ${dbPath}`);
