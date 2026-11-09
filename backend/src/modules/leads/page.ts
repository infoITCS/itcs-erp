export type LeadSort = "createdAt" | "displayName" | "leadNumber" | "estimatedValue";

export interface LeadCursor {
  sort: LeadSort;
  value: string;
  id: string;
}

export function encodeLeadCursor(cursor: LeadCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeLeadCursor(cursor: string): LeadCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "sort" in parsed &&
      "value" in parsed &&
      "id" in parsed &&
      (parsed.sort === "createdAt" ||
        parsed.sort === "displayName" ||
        parsed.sort === "leadNumber" ||
        parsed.sort === "estimatedValue") &&
      typeof parsed.value === "string" &&
      typeof parsed.id === "string"
    ) {
      return { sort: parsed.sort, value: parsed.value, id: parsed.id };
    }
    return null;
  } catch {
    return null;
  }
}

export function leadCursorWhere(cursor: LeadCursor, order: "asc" | "desc"): Record<string, unknown> {
  const field = cursor.sort;
  const value = cursor.sort === "createdAt" ? new Date(cursor.value) : cursor.value;
  const compare = order === "desc" ? "lt" : "gt";
  return {
    OR: [
      { [field]: { [compare]: value } },
      { AND: [{ [field]: value }, { id: { [compare]: cursor.id } }] },
    ],
  };
}

export function toLeadPage<
  T extends { id: string; createdAt: Date; displayName: string; leadNumber: string; estimatedValue: unknown },
>(rows: T[], limit: number, sort: LeadSort) {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const value =
    last === undefined
      ? null
      : sort === "createdAt"
        ? last.createdAt.toISOString()
        : sort === "displayName"
          ? last.displayName
          : sort === "leadNumber"
            ? last.leadNumber
            : String(last.estimatedValue);

  return {
    items,
    pageInfo: {
      limit,
      hasNextPage,
      nextCursor: hasNextPage && last && value !== null ? encodeLeadCursor({ sort, value, id: last.id }) : null,
    },
  };
}
