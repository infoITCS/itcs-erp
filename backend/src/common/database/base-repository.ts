import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Repositories own database access. Services never call Prisma directly.
 * The protected client is available to every module repository.
 */
export abstract class BaseRepository {
  constructor(protected readonly db: PrismaClient) {}

  protected transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.db.$transaction(fn);
  }
}
