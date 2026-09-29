import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ValidationFailedError } from "../src/common/errors/app-error";
import { assertDecimalString, selectEffectiveRate } from "../src/common/money/decimal";

describe("currency handling", () => {
  it("accepts a decimal string and rejects extra scale or non-decimal text", () => {
    assert.equal(assertDecimalString("278.50", 8), "278.50");
    assert.throws(() => assertDecimalString("278.123456789", 8), ValidationFailedError);
    assert.throws(() => assertDecimalString("1e2", 8), ValidationFailedError);
    assert.throws(() => assertDecimalString("12.5.1", 8), ValidationFailedError);
  });

  it("selects the latest active rate on or before the requested date", () => {
    const selected = selectEffectiveRate(
      [
        { effectiveDate: "2026-01-01", rate: "278.50000000", isActive: true },
        { effectiveDate: "2026-06-01", rate: "280.00000000", isActive: false },
        { effectiveDate: "2026-03-01", rate: "279.25000000", isActive: true },
        { effectiveDate: "2026-12-01", rate: "290.00000000", isActive: true },
      ],
      "2026-07-01",
    );

    assert.equal(selected?.rate, "279.25000000");
  });
});
