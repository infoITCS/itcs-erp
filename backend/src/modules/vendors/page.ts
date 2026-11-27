export type VendorSort = "createdAt" | "name" | "vendorNumber" | "code" | "status";

export interface VendorCursor {
  sort: VendorSort;
  value: string;
  id: string;
}

const vendorSorts: VendorSort[] = ["createdAt", "name", "vendorNumber", "code", "status"];

export function encodeVendorCursor(cursor: VendorCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeVendorCursor(cursor: string): VendorCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "sort" in parsed &&
      "value" in parsed &&
      "id" in parsed &&
      typeof parsed.sort === "string" &&
      vendorSorts.includes(parsed.sort as VendorSort) &&
      typeof parsed.value === "string" &&
      typeof parsed.id === "string"
    ) {
      return { sort: parsed.sort as VendorSort, value: parsed.value, id: parsed.id };
    }
    return null;
  } catch {
    return null;
  }
}

export function vendorCursorWhere(cursor: VendorCursor, order: "asc" | "desc"): Record<string, unknown> {
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

export function toVendorPage<
  T extends { id: string; createdAt: Date; name: string; vendorNumber: string; code: string | null; status: string },
>(rows: T[], limit: number, sort: VendorSort) {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const value =
    last === undefined
      ? null
      : sort === "createdAt"
        ? last.createdAt.toISOString()
        : sort === "name"
          ? last.name
          : sort === "vendorNumber"
            ? last.vendorNumber
            : sort === "status"
              ? last.status
              : last.code;

  return {
    items,
    pageInfo: {
      limit,
      hasNextPage,
      nextCursor: hasNextPage && last && value !== null ? encodeVendorCursor({ sort, value, id: last.id }) : null,
    },
  };
}
