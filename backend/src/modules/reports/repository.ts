import type { PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";

/** Aggregates use the read client so reporting can move to a replica later. */
export class ReportsRepository extends BaseRepository {
  constructor(db: PrismaClient, protected readonly readDb: PrismaClient) {
    super(db);
  }

  protected getReadClient(): PrismaClient {
    return this.readDb;
  }
}
