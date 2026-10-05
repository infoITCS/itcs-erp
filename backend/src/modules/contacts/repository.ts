import { Prisma, type PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { ConflictError } from "../../common/errors/app-error";
import { cursorFilter, decodeCursor } from "../../common/pagination/cursor";
import { contactDisplayName } from "./names";
import type { ContactBody, UpdateContactInput } from "./validation";

const contactSelect = {
  id: true,
  customerId: true,
  firstName: true,
  lastName: true,
  displayName: true,
  jobTitle: true,
  department: true,
  email: true,
  phone: true,
  mobile: true,
  isPrimary: true,
  status: true,
  notes: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContactSelect;

export type ContactRecord = Prisma.ContactGetPayload<{ select: typeof contactSelect }>;

export class ContactsRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async findPrimary(organizationId: string, customerId: string) {
    return this.db.contact.findFirst({
      where: { organizationId, customerId, deletedAt: null, isPrimary: true },
      select: { id: true },
    });
  }

  async customerIsActive(organizationId: string, customerId: string): Promise<boolean> {
    const customer = await this.db.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { id: true },
    });
    return customer !== null;
  }

  async list(organizationId: string, customerId: string, limit: number, cursor?: string, includeDeleted = false) {
    const decoded = cursor ? decodeCursor(cursor) : null;
    return this.db.contact.findMany({
      where: {
        organizationId,
        customerId,
        ...(includeDeleted ? {} : { deletedAt: null }),
        ...(decoded ? cursorFilter(decoded, "desc") : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: contactSelect,
    });
  }

  async findById(organizationId: string, id: string, includeDeleted = false) {
    return this.db.contact.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: contactSelect,
    });
  }

  async create(organizationId: string, customerId: string, actorId: string, input: ContactBody) {
    try {
      return await this.transaction(async (tx) => {
        if (input.isPrimary) {
          await clearPrimary(tx, organizationId, customerId, actorId);
        }
        return tx.contact.create({
          data: contactData(organizationId, customerId, actorId, input),
          select: contactSelect,
        });
      });
    } catch (error) {
      throw mapConflict(error);
    }
  }

  async update(organizationId: string, id: string, actorId: string, input: UpdateContactInput) {
    const existing = await this.findById(organizationId, id);
    if (!existing) {
      return null;
    }
    const firstName = input.firstName ?? existing.firstName;
    const lastName = input.lastName ?? existing.lastName;
    try {
      return await this.transaction(async (tx) => {
        if (input.isPrimary) {
          await clearPrimary(tx, organizationId, existing.customerId, actorId, id);
        }
        return tx.contact.update({
          where: { id },
          data: {
            ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
            ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
            ...(input.firstName !== undefined || input.lastName !== undefined || input.displayName !== undefined
              ? { displayName: contactDisplayName(firstName, lastName, input.displayName ?? existing.displayName) }
              : {}),
            ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle ?? null } : {}),
            ...(input.department !== undefined ? { department: input.department ?? null } : {}),
            ...(input.email !== undefined ? { email: input.email ?? null } : {}),
            ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
            ...(input.mobile !== undefined ? { mobile: input.mobile ?? null } : {}),
            ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
            updatedById: actorId,
          },
          select: contactSelect,
        });
      });
    } catch (error) {
      throw mapConflict(error);
    }
  }

  async softDelete(organizationId: string, id: string, actorId: string) {
    const existing = await this.findById(organizationId, id);
    if (!existing) {
      return null;
    }
    await this.db.contact.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return existing;
  }

  async restore(organizationId: string, id: string, actorId: string) {
    const existing = await this.findById(organizationId, id, true);
    if (!existing?.deletedAt) {
      return null;
    }
    return this.db.contact.update({
      where: { id },
      data: { deletedAt: null, updatedById: actorId },
      select: contactSelect,
    });
  }
}

function contactData(organizationId: string, customerId: string, actorId: string, input: ContactBody) {
  return {
    organizationId,
    customerId,
    firstName: input.firstName,
    lastName: input.lastName,
    displayName: contactDisplayName(input.firstName, input.lastName, input.displayName),
    jobTitle: input.jobTitle ?? null,
    department: input.department ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    mobile: input.mobile ?? null,
    isPrimary: input.isPrimary ?? false,
    status: input.status ?? "ACTIVE",
    notes: input.notes ?? null,
    createdById: actorId,
    updatedById: actorId,
  };
}

async function clearPrimary(
  tx: Prisma.TransactionClient,
  organizationId: string,
  customerId: string,
  actorId: string,
  exceptId?: string,
) {
  await tx.contact.updateMany({
    where: {
      organizationId,
      customerId,
      deletedAt: null,
      isPrimary: true,
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    data: { isPrimary: false, updatedById: actorId },
  });
}

function mapConflict(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictError("This customer already has a primary contact");
  }
  return error;
}
