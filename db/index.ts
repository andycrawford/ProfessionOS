import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { schema } from "./schema";

// Lazy singleton — the Neon HTTP client is created once per process.
// In serverless environments each function instance gets its own singleton,
// which avoids the overhead of connection setup on every request while
// staying compatible with stateless execution (no persistent TCP connections).
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Add it to .env.local (dev) or Vercel environment variables (prod)."
      );
    }
    _db = drizzle(neon(url), { schema });
  }
  return _db;
}

// Convenience default export for call sites that import `db` directly.
// Use `getDb()` instead if you need deferred initialization in module scope.
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export type Db = ReturnType<typeof getDb>;
