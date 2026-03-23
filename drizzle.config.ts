import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./packages/shared/src/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/council.db"
  }
});
