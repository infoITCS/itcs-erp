import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAllowedMicrosoftEmail,
  normalizeMicrosoftDomain,
} from "../src/modules/auth/microsoft";

describe("microsoft sign-in domain", () => {
  it("normalizes a configured domain", () => {
    assert.equal(normalizeMicrosoftDomain(" @ITCS.com.pk "), "itcs.com.pk");
  });

  it("allows only email addresses on the company domain", () => {
    assert.equal(isAllowedMicrosoftEmail("Ali.Khan@ITCS.com.pk", "itcs.com.pk"), true);
    assert.equal(isAllowedMicrosoftEmail("ali@itcs.com.pk.evil.com", "itcs.com.pk"), false);
    assert.equal(isAllowedMicrosoftEmail("ali@notitcs.com.pk", "itcs.com.pk"), false);
    assert.equal(isAllowedMicrosoftEmail("ali@example.com", "itcs.com.pk"), false);
    assert.equal(isAllowedMicrosoftEmail("not-an-email", "itcs.com.pk"), false);
    assert.equal(isAllowedMicrosoftEmail("ali@itcs.com.pk@evil.com", "itcs.com.pk"), false);
    assert.equal(isAllowedMicrosoftEmail("ali@@itcs.com.pk", "itcs.com.pk"), false);
  });
});
