import type { PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";

export class DocumentSequencesRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list(organizationId: string, year: number) {
    return this.db.documentSequence.findMany({
      where: { organizationId, year },
      orderBy: { documentType: "asc" },
      select: {
        documentType: true,
        prefix: true,
        nextNumber: true,
        padding: true,
        year: true,
      },
    });
  }
}
