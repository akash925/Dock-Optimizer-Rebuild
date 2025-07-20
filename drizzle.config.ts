import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./shared/schema.ts", // ← keep if correct
  out: "./drizzle/migrations", // ← tell Drizzle where the .sql files are
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
