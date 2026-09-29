import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  readPrisma?: PrismaClient;
};

function createPrismaClient(connectionString: string): PrismaClient {
  const pool = new Pool({
    connectionString,
    max: env.DATABASE_POOL_MAX,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });

  return new PrismaClient({
    adapter: new PrismaPg(pool, { disposeExternalPool: true }),
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/** Primary client. All writes and transactional reads go through this pool. */
export const prisma = globalForPrisma.prisma ?? createPrismaClient(env.DATABASE_URL);

/**
 * Read client. Uses READ_DATABASE_URL when a replica is configured.
 * Until then, reads share the primary pool.
 */
export const readPrisma =
  globalForPrisma.readPrisma ??
  (env.READ_DATABASE_URL ? createPrismaClient(env.READ_DATABASE_URL) : prisma);

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
  globalForPrisma.readPrisma = readPrisma;
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  if (readPrisma !== prisma) {
    await readPrisma.$disconnect();
  }
}
