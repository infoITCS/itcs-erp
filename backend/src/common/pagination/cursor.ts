export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export interface CursorKey {
  createdAt: string;
  id: string;
}

export function encodeCursor(key: CursorKey): string {
  return Buffer.from(JSON.stringify(key), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorKey | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "createdAt" in parsed &&
      "id" in parsed &&
      typeof parsed.createdAt === "string" &&
      typeof parsed.id === "string" &&
      !Number.isNaN(Date.parse(parsed.createdAt))
    ) {
      return { createdAt: parsed.createdAt, id: parsed.id };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Keyset predicate for a stable (createdAt, id) order.
 * Callers apply this inside Prisma `where` so the database, not Node, pages the set.
 */
export function cursorFilter(cursor: CursorKey, order: "asc" | "desc"): Record<string, unknown> {
  const createdAt = new Date(cursor.createdAt);
  if (order === "desc") {
    return {
      OR: [
        { createdAt: { lt: createdAt } },
        { AND: [{ createdAt }, { id: { lt: cursor.id } }] },
      ],
    };
  }

  return {
    OR: [
      { createdAt: { gt: createdAt } },
      { AND: [{ createdAt }, { id: { gt: cursor.id } }] },
    ],
  };
}

export interface PageResult<T> {
  items: T[];
  pageInfo: {
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
}

export function toCursorPage<T extends { id: string; createdAt: Date }>(
  rows: T[],
  limit: number,
): PageResult<T> {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  return {
    items,
    pageInfo: {
      limit,
      hasNextPage,
      nextCursor: hasNextPage && last ? encodeCursor({ id: last.id, createdAt: last.createdAt.toISOString() }) : null,
    },
  };
}
