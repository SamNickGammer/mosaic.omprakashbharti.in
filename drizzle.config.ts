import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only diffs the schema and does not need a live
// connection, so we fall back to a placeholder. `push`/`migrate`/`studio`
// require a real DATABASE_URL in the environment.
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/mosaic";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
