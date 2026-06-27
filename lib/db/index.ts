import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Add your Neon connection string to .env.local",
  );
}

// `cache: "no-store"` is critical: Next.js patches global fetch and will cache
// the neon-http driver's query responses, returning stale rows (e.g. a long-poll
// re-running the same query would see its first, now-outdated result). DB reads
// must never be cached.
const sql = neon(connectionString, { fetchOptions: { cache: "no-store" } });

export const db = drizzle(sql, { schema });

export { schema };
