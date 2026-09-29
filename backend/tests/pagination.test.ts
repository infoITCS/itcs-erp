import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cursorFilter, decodeCursor, encodeCursor, toCursorPage } from "../src/common/pagination/cursor";
import { offsetPage } from "../src/common/pagination/offset";
import { resolveSort } from "../src/common/pagination/list-query";

describe("pagination", () => {
  it("round-trips a cursor", () => {
    const encoded = encodeCursor({ id: "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11", createdAt: "2026-01-02T03:04:05.000Z" });
    assert.deepEqual(decodeCursor(encoded), {
      id: "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11",
      createdAt: "2026-01-02T03:04:05.000Z",
    });
  });

  it("rejects a malformed cursor", () => {
    assert.equal(decodeCursor("not-a-cursor"), null);
  });

  it("builds a descending keyset filter", () => {
    const filter = cursorFilter(
      { id: "abc", createdAt: "2026-01-02T03:04:05.000Z" },
      "desc",
    );
    assert.ok(filter.OR);
  });

  it("keeps one extra row as the next page signal", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const page = toCursorPage(
      [
        { id: "1", createdAt },
        { id: "2", createdAt },
      ],
      1,
    );
    assert.equal(page.items.length, 1);
    assert.equal(page.pageInfo.hasNextPage, true);
    assert.ok(page.pageInfo.nextCursor);
  });

  it("caps offset pages", () => {
    assert.deepEqual(offsetPage(2, 500), { page: 2, limit: 100, skip: 100 });
  });

  it("ignores sort fields that are not allow-listed", () => {
    assert.equal(resolveSort("passwordHash", ["name", "createdAt"], "createdAt"), "createdAt");
    assert.equal(resolveSort("name", ["name", "createdAt"], "createdAt"), "name");
  });
});
