import { MAX_PAGE_SIZE } from "./cursor";

export interface OffsetPage {
  page: number;
  limit: number;
  skip: number;
}

/** Offset paging is for small admin lists. High-volume lists use cursors. */
export function offsetPage(pageInput: number, limitInput: number): OffsetPage {
  const page = Number.isFinite(pageInput) && pageInput > 0 ? Math.floor(pageInput) : 1;
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(limitInput) || 1));
  return { page, limit, skip: (page - 1) * limit };
}
