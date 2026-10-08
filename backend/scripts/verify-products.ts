import assert from "node:assert/strict";
import "dotenv/config";
import request from "supertest";
import { createApp } from "../src/app";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD required");
  }

  const app = createApp();
  const login = await request(app).post("/api/v1/auth/login").send({ email, password });
  assert.equal(login.status, 200, login.body.message);
  const token = login.body.data.accessToken as string;
  const auth = { Authorization: `Bearer ${token}` };

  const units = await request(app).get("/api/v1/units-of-measure").set(auth);
  assert.equal(units.status, 200);
  const each = units.body.data.find((row: { code: string }) => row.code === "EACH");
  assert.ok(each);

  const taxes = await request(app).get("/api/v1/tax-codes").set(auth);
  assert.equal(taxes.status, 200);
  const std = taxes.body.data.find((row: { code: string }) => row.code === "STD");
  assert.ok(std);

  const categoryCode = `NET${Date.now().toString().slice(-4)}`;
  const category = await request(app)
    .post("/api/v1/categories")
    .set(auth)
    .send({ code: categoryCode, name: "Networking" });
  assert.equal(category.status, 201, JSON.stringify(category.body));

  const product = await request(app)
    .post("/api/v1/products")
    .set(auth)
    .send({
      name: "Edge firewall appliance",
      productType: "PHYSICAL_PRODUCT",
      unitOfMeasureId: each.id,
      taxCodeId: std.id,
      categoryId: category.body.data.id,
      trackInventory: true,
      initialSalesPrice: {
        priceType: "SALES",
        currencyCode: "PKR",
        amount: "250000.0000",
        effectiveDate: "2026-01-01",
        expiryDate: "2026-06-30",
      },
    });
  assert.equal(product.status, 201, JSON.stringify(product.body));
  assert.match(product.body.data.code, /^PRD-2026-\d{5}$/);

  const serviceBad = await request(app)
    .post("/api/v1/products")
    .set(auth)
    .send({
      name: "Managed SOC",
      productType: "SERVICE",
      unitOfMeasureId: each.id,
      trackInventory: true,
    });
  assert.equal(serviceBad.status, 400);

  const okService = await request(app)
    .post("/api/v1/products")
    .set(auth)
    .send({
      name: "Managed SOC",
      productType: "SERVICE",
      unitOfMeasureId: each.id,
    });
  assert.equal(okService.status, 201, JSON.stringify(okService.body));
  assert.equal(okService.body.data.trackInventory, false);

  const overlap = await request(app)
    .post(`/api/v1/products/${product.body.data.id}/prices`)
    .set(auth)
    .send({
      priceType: "SALES",
      currencyCode: "PKR",
      amount: "260000.0000",
      effectiveDate: "2026-06-01",
      expiryDate: "2026-12-31",
    });
  assert.equal(overlap.status, 409, JSON.stringify(overlap.body));

  const adjacent = await request(app)
    .post(`/api/v1/products/${product.body.data.id}/prices`)
    .set(auth)
    .send({
      priceType: "SALES",
      currencyCode: "PKR",
      amount: "260000.0000",
      effectiveDate: "2026-07-01",
      expiryDate: "2026-12-31",
    });
  assert.equal(adjacent.status, 201, JSON.stringify(adjacent.body));

  const listed = await request(app).get("/api/v1/products").query({ q: "firewall", limit: 20 }).set(auth);
  assert.equal(listed.status, 200);
  assert.ok(listed.body.data.items.some((row: { id: string }) => row.id === product.body.data.id));

  const deleted = await request(app).delete(`/api/v1/products/${product.body.data.id}`).set(auth);
  assert.equal(deleted.status, 200);

  const restored = await request(app).post(`/api/v1/products/${product.body.data.id}/restore`).set(auth);
  assert.equal(restored.status, 200);

  console.log(
    JSON.stringify(
      {
        ok: true,
        productCode: product.body.data.code,
        serviceCode: okService.body.data.code,
        category: category.body.data.code,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
