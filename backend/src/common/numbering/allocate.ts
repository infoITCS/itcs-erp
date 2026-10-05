import { DocumentType, type Prisma, type PrismaClient } from "@prisma/client";
import { NotFoundError } from "../errors/app-error";
import { formatDocumentNumber } from "./format";

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
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM document_sequences
    WHERE organization_id = ${organizationId}::uuid
      AND document_type = ${documentType}::document_type
      AND year = ${year}
    FOR UPDATE
  `;

  const rowId = locked[0]?.id;
  if (!rowId) {
    throw new NotFoundError("Document sequence is not configured for this year");
  }

  const updated = await tx.documentSequence.update({
    where: { id: rowId },
    data: { nextNumber: { increment: 1 } },
    select: { prefix: true, padding: true, nextNumber: true },
  });

  return formatDocumentNumber(updated.prefix, year, updated.nextNumber - 1, updated.padding);
}
