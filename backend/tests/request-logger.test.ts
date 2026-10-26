import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { redactRequestUrl } from "../src/common/logging/request-logger";

describe("request logging", () => {
  it("redacts sensitive authentication query values", () => {
    const redacted = redactRequestUrl(
      "/api/v1/auth/microsoft/callback?code=secret-code&state=secret-state&ticket=secret-ticket&keep=1",
    );

    assert.equal(redacted.includes("secret-code"), false);
    assert.equal(redacted.includes("secret-state"), false);
    assert.equal(redacted.includes("secret-ticket"), false);
    assert.equal(redacted.includes("keep=1"), true);
  });

  it("leaves URLs without sensitive parameters unchanged", () => {
    assert.equal(redactRequestUrl("/api/v1/users?limit=20"), "/api/v1/users?limit=20");
  });
});
