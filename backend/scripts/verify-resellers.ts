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

  const reseller = await request(app)
    .post("/api/v1/resellers")
    .set(auth)
    .send({
      legalName: "Verify Partners LLC",
      displayName: "Verify Partners",
      countryCode: "PK",
      currencyCode: "PKR",
      priceListCode: "RESELLER",
      defaultDiscountPercent: "7.5000",
      defaultCommissionPercent: "5.0000",
    });
  assert.equal(reseller.status, 201, JSON.stringify(reseller.body));
  assert.match(reseller.body.data.resellerNumber, /^RSL-2026-\d{5}$/);

  const suspended = await request(app)
    .post("/api/v1/resellers")
    .set(auth)
    .send({
      legalName: "Suspended Co",
      displayName: "Suspended Co",
      countryCode: "PK",
      currencyCode: "PKR",
      status: "SUSPENDED",
    });
  assert.equal(suspended.status, 201, JSON.stringify(suspended.body));

  const customer = await request(app)
    .post("/api/v1/customers")
    .set(auth)
    .send({
      customerType: "COMPANY",
      legalName: "Reseller Smoke Customer",
      displayName: "Reseller Smoke",
      countryCode: "PK",
      currencyCode: "PKR",
    });
  assert.equal(customer.status, 201, JSON.stringify(customer.body));

  const badAssign = await request(app)
    .post(`/api/v1/resellers/${suspended.body.data.id}/customers/${customer.body.data.customer.id}`)
    .set(auth);
  assert.equal(badAssign.status, 400);

  const assign = await request(app)
    .post(`/api/v1/resellers/${reseller.body.data.id}/customers/${customer.body.data.customer.id}`)
    .set(auth);
  assert.equal(assign.status, 200, JSON.stringify(assign.body));

  const address = await request(app)
    .post(`/api/v1/resellers/${reseller.body.data.id}/addresses`)
    .set(auth)
    .send({
      purpose: "BILLING",
      isPrimary: true,
      line1: "1 Partner Street",
      city: "Lahore",
      countryCode: "PK",
    });
  assert.equal(address.status, 201, JSON.stringify(address.body));

  const contact = await request(app)
    .post(`/api/v1/resellers/${reseller.body.data.id}/contacts`)
    .set(auth)
    .send({ firstName: "Sam", lastName: "Partner", isPrimary: true });
  assert.equal(contact.status, 201, JSON.stringify(contact.body));

  const deleted = await request(app).delete(`/api/v1/resellers/${reseller.body.data.id}`).set(auth);
  assert.equal(deleted.status, 200);

  const restored = await request(app).post(`/api/v1/resellers/${reseller.body.data.id}/restore`).set(auth);
  assert.equal(restored.status, 200);

  console.log(
    JSON.stringify(
      {
        ok: true,
        resellerNumber: reseller.body.data.resellerNumber,
        priceListCode: reseller.body.data.priceListCode,
        assignedCustomer: customer.body.data.customer.customerNumber,
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
