import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app";
import { env } from "../src/config/env";

describe("API envelope", () => {
  it("GET /api/v1/health returns the running envelope", async () => {
    const response = await request(createApp()).get("/api/v1/health");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      success: true,
      message: "ERP API is running",
    });
  });

  it("returns a consistent error for unknown routes", async () => {
    const response = await request(createApp()).get("/api/v1/does-not-exist");

    assert.equal(response.status, 404);
    assert.equal(response.body.success, false);
    assert.match(response.body.message, /Route not found/);
  });

  it("rejects an invalid login body before business logic", async () => {
    const response = await request(createApp()).post("/api/v1/auth/login").send({ email: "not-an-email" });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, "Validation failed");
    assert.ok(response.body.errors);
  });

  it("allows browser preflight requests for profile avatar uploads", async () => {
    const origin = env.CORS_ORIGIN.split(",")[0].trim();
    const response = await request(createApp())
      .options("/api/v1/profile/avatar")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "PUT")
      .set("Access-Control-Request-Headers", "authorization,content-type");

    assert.equal(response.status, 204);
    assert.match(String(response.headers["access-control-allow-methods"]), /\bPUT\b/);
    assert.equal(response.headers["access-control-allow-origin"], origin);
  });
});
