import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, verifyPassword } from "../src/modules/auth/password";
import { signAccessToken, verifyAccessToken } from "../src/modules/auth/tokens";
import { requirePermission } from "../src/middleware/authorize";
import type { NextFunction, Request, Response } from "express";

describe("auth structure", () => {
  it("hashes passwords with bcrypt and never returns the plain value", async () => {
    const plain = "correct-horse-battery";
    const hashed = await hashPassword(plain);

    assert.notEqual(hashed, plain);
    assert.match(hashed, /^\$2[aby]\$/);
    assert.equal(await verifyPassword(plain, hashed), true);
    assert.equal(await verifyPassword("wrong-password", hashed), false);
  });

  it("round-trips a stateless access token", () => {
    const token = signAccessToken(
      {
        userId: "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11",
        email: "ada@example.com",
        organizationId: "8d6c1b2a-4e3f-4a1b-9c2d-1a2b3c4d5e6f",
        roles: ["accountant"],
        permissions: ["invoices:read"],
      },
      "5m",
    );

    assert.deepEqual(verifyAccessToken(token), {
      userId: "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11",
      email: "ada@example.com",
      roles: ["accountant"],
      permissions: ["invoices:read"],
      organizationId: "8d6c1b2a-4e3f-4a1b-9c2d-1a2b3c4d5e6f",
    });
    assert.equal(verifyAccessToken("not-a-token"), null);
  });

  it("denies a request that lacks the required permission", () => {
    const middleware = requirePermission("invoices:approve");
    const req = {
      auth: {
        userId: "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11",
        email: "ada@example.com",
        roles: ["accountant"],
        permissions: ["invoices:read"],
      },
    } as Request;

    let forwarded: unknown;
    const next: NextFunction = (error?: unknown) => {
      forwarded = error;
    };

    middleware(req, {} as Response, next);
    assert.equal((forwarded as { statusCode?: number }).statusCode, 403);
  });
});
