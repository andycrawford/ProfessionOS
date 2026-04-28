import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load .env.local so drizzle-kit CLI picks up DATABASE_URL in dev
// (Next.js loads this automatically at runtime, but drizzle-kit does not).
config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
