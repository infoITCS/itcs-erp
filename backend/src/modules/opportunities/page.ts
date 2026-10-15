export type OpportunitySort = "createdAt" | "title" | "opportunityNumber";

export interface OpportunityCursor {
  sort: OpportunitySort;
  value: string;
  id: string;
}

export function encodeOpportunityCursor(cursor: OpportunityCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeOpportunityCursor(cursor: string): OpportunityCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "sort" in parsed &&
      "value" in parsed &&
      "id" in parsed &&
      (parsed.sort === "createdAt" || parsed.sort === "title" || parsed.sort === "opportunityNumber") &&
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

export function opportunityCursorWhere(cursor: OpportunityCursor, order: "asc" | "desc"): Record<string, unknown> {
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

export function toOpportunityPage<
  T extends { id: string; createdAt: Date; title: string; opportunityNumber: string },
>(rows: T[], limit: number, sort: OpportunitySort) {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const value =
    last === undefined
      ? null
      : sort === "createdAt"
        ? last.createdAt.toISOString()
        : sort === "title"
          ? last.title
          : last.opportunityNumber;

  return {
    items,
    pageInfo: {
      limit,
      hasNextPage,
      nextCursor: hasNextPage && last && value !== null ? encodeOpportunityCursor({ sort, value, id: last.id }) : null,
    },
  };
}
