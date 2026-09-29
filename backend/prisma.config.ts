import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations use the direct primary URL. The API pool uses DATABASE_URL,
    // which can later point at PgBouncer without changing module code.
    url: env("DIRECT_URL"),
  },
});
