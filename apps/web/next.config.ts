import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
  transpilePackages: [
    "@pillow-council/shared",
    "@pillow-council/agents",
    "@pillow-council/orchestration",
    "@pillow-council/providers",
    "@pillow-council/exports"
  ],
  outputFileTracingRoot: path.join(currentDir, "../../"),
  serverExternalPackages: ["better-sqlite3"]
};

export default nextConfig;
