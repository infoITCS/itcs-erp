import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDocumentNumber } from "../src/common/numbering/format";

describe("document numbers", () => {
  it("formats a yearly padded number without using a float", () => {
    assert.equal(formatDocumentNumber("INV", 2026, 1, 5), "INV-2026-00001");
    assert.equal(formatDocumentNumber("PO", 2026, 42, 5), "PO-2026-00042");
  });
});
