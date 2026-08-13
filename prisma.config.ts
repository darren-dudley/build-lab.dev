import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma CLI (migrate/studio/seed) uses the DIRECT (non-pooler) Neon URL.
// Runtime clients use the pooled URL via @prisma/adapter-neon (src/server/db.ts).
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_DATABASE_URL"),
  },
});
