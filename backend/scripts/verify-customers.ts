import "dotenv/config";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app";
import { disconnectDatabase } from "../src/config/database";

const app = createApp();
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
}

const stamp = Date.now().toString();
const displayName = `Verify ${stamp}`;

async function main(): Promise<void> {
  const unauthenticated = await request(app).get("/api/v1/customers");
  assert.equal(unauthenticated.status, 401);

  const login = await request(app).post("/api/v1/auth/login").send({ email, password });
  assert.equal(login.status, 200, login.body.message);
  const token = login.body.data.accessToken as string;
  const auth = { Authorization: `Bearer ${token}` };

  const rejectedNumber = await request(app)
    .post("/api/v1/customers")
    .set(auth)
    .send({
      customerNumber: "CUS-2026-00001",
      customerType: "COMPANY",
      legalName: displayName,
      displayName,
      countryCode: "PK",
      currencyCode: "PKR",
    });
  assert.equal(rejectedNumber.status, 400);

  const created = await request(app).post("/api/v1/customers").set(auth).send({
    customerType: "COMPANY",
    legalName: `${displayName} LLC`,
    displayName,
    email: `billing-${stamp}@example.com`,
    phone: "03001234567",
    countryCode: "PK",
    currencyCode: "PKR",
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const customerId = created.body.data.customer.id as string;
  assert.match(created.body.data.customer.customerNumber, /^CUS-2026-\d{5}$/);
  assert.equal(created.body.data.possibleDuplicate, false);

  const duplicate = await request(app).post("/api/v1/customers").set(auth).send({
    customerType: "COMPANY",
    legalName: `${displayName} Duplicate`,
    displayName: `${displayName} Duplicate`,
    email: `billing-${stamp}@example.com`,
    countryCode: "PK",
    currencyCode: "PKR",
  });
  assert.equal(duplicate.status, 201);
  assert.equal(duplicate.body.data.possibleDuplicate, true);

  const listed = await request(app).get("/api/v1/customers").set(auth).query({ q: displayName, status: "ACTIVE", country: "PK", limit: 50 });
  assert.equal(listed.status, 200);
  assert.ok(listed.body.data.items.some((row: { id: string }) => row.id === customerId));
  assert.ok(listed.body.data.pageInfo.limit <= 100);

  const address = await request(app).post(`/api/v1/customers/${customerId}/addresses`).set(auth).send({
    purpose: "BILLING",
    isPrimary: true,
    line1: "1 Market Road",
    city: "Karachi",
    countryCode: "PK",
  });
  assert.equal(address.status, 201, JSON.stringify(address.body));

  const firstContact = await request(app).post(`/api/v1/customers/${customerId}/contacts`).set(auth).send({
    firstName: "Ada",
    lastName: "Lovelace",
    isPrimary: true,
  });
  assert.equal(firstContact.status, 201, JSON.stringify(firstContact.body));

  const secondContact = await request(app).post(`/api/v1/customers/${customerId}/contacts`).set(auth).send({
    firstName: "Grace",
    lastName: "Hopper",
    isPrimary: true,
  });
  assert.equal(secondContact.status, 201);
  const contacts = await request(app).get(`/api/v1/customers/${customerId}/contacts`).set(auth);
  const primaries = contacts.body.data.items.filter((row: { isPrimary: boolean }) => row.isPrimary);
  assert.equal(primaries.length, 1);
  assert.equal(primaries[0].displayName, "Grace Hopper");

  const updated = await request(app).patch(`/api/v1/customers/${customerId}`).set(auth).send({ status: "INACTIVE" });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.status, "INACTIVE");

  const removedAddress = await request(app).delete(`/api/v1/customers/${customerId}/addresses/${address.body.data.id}`).set(auth);
  assert.equal(removedAddress.status, 200);
  const removedContact = await request(app).delete(`/api/v1/contacts/${secondContact.body.data.id}`).set(auth);
  assert.equal(removedContact.status, 200);

  const audit = await request(app).get("/api/v1/audit-logs").set(auth).query({ subjectId: customerId, limit: 50 });
  assert.equal(audit.status, 200);
  const actions = audit.body.data.items.map((row: { action: string }) => row.action);
  for (const action of ["customers.created", "customers.status.changed", "customers.address.created", "contacts.created", "contacts.primary.changed", "contacts.deleted"]) {
    assert.ok(actions.includes(action), action);
  }

  const removed = await request(app).delete(`/api/v1/customers/${customerId}`).set(auth);
  assert.equal(removed.status, 200);
  const hidden = await request(app).get(`/api/v1/customers/${customerId}`).set(auth);
  assert.equal(hidden.status, 404);
  const restored = await request(app).post(`/api/v1/customers/${customerId}/restore`).set(auth);
  assert.equal(restored.status, 200);
  assert.equal(restored.body.data.displayName, displayName);

  const otherOrg = await request(app).get("/api/v1/customers/11111111-1111-4111-8111-111111111111").set(auth);
  assert.equal(otherOrg.status, 404);

  console.log("customer, contact, address, search, permission, and audit checks passed");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
