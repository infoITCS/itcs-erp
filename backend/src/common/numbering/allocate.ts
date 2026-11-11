import { DocumentType, type Prisma, type PrismaClient } from "@prisma/client";
import { DOCUMENT_PREFIX, formatDocumentNumber } from "./format";

type SequenceClient = PrismaClient | Prisma.TransactionClient;

export async function allocateDocumentNumber(
  db: PrismaClient,
  organizationId: string,
  documentType: DocumentType,
  year = new Date().getUTCFullYear(),
): Promise<string> {
  return db.$transaction((tx) => allocateDocumentNumberIn(tx, organizationId, documentType, year));
}

/** Allocates inside the caller's transaction so the number and the insert commit together. */
export async function allocateDocumentNumberIn(
  tx: SequenceClient,
  organizationId: string,
  documentType: DocumentType,
  year = new Date().getUTCFullYear(),
): Promise<string> {
  const lockRow = () =>
    tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM document_sequences
      WHERE organization_id = ${organizationId}::uuid
        AND document_type = ${documentType}::document_type
        AND year = ${year}
      FOR UPDATE
    `;

  let locked = await lockRow();

  if (!locked[0]) {
    await tx.documentSequence.upsert({
      where: { organizationId_documentType_year: { organizationId, documentType, year } },
      update: {},
      create: {
        organizationId,
        documentType,
        prefix: DOCUMENT_PREFIX[documentType],
        nextNumber: 1,
        padding: 5,
        year,
      },
    });
    locked = await lockRow();
  }

  const rowId = locked[0]?.id;
  if (!rowId) {
    throw new Error("Failed to initialize the document sequence");
  }

  const updated = await tx.documentSequence.update({
    where: { id: rowId },
    data: { nextNumber: { increment: 1 } },
    select: { prefix: true, padding: true, nextNumber: true },
  });

  return formatDocumentNumber(updated.prefix, year, updated.nextNumber - 1, updated.padding);
}
