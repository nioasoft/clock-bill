import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Migrations need DDL privileges — use the admin role when provided,
    // falling back to DATABASE_URL. The app runtime uses the restricted role.
    url: (process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL)!,
  },
});
