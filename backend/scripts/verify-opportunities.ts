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
  const each = units.body.data.find((row: { code: string }) => row.code === "EACH");
  assert.ok(each, "expected an EACH unit of measure to be seeded");

  const product = await request(app)
    .post("/api/v1/products")
    .set(auth)
    .send({ name: "Edge firewall appliance", productType: "PHYSICAL_PRODUCT", unitOfMeasureId: each.id });
  assert.equal(product.status, 201, JSON.stringify(product.body));

  // --- Create a prospect opportunity priced in USD; the org's base currency is PKR, so the
  // snapshot should be computed via the seeded USD->PKR rate. ---
  const opportunity = await request(app)
    .post("/api/v1/opportunities")
    .set(auth)
    .send({
      title: "Edge security refresh",
      currencyCode: "USD",
      estimatedValue: "1000.0000",
      prospectDisplayName: "Northwind Prospect",
      prospectEmail: `prospect-${Date.now()}@example.com`,
    });
  assert.equal(opportunity.status, 201, JSON.stringify(opportunity.body));
  assert.match(opportunity.body.data.opportunityNumber, /^OPP-2026-\d{5}$/);
  assert.equal(opportunity.body.data.stage, "NEW");
  assert.equal(opportunity.body.data.probabilityPercent, 10);
  assert.equal(opportunity.body.data.baseCurrencyCode, "PKR");
  assert.equal(Number(opportunity.body.data.estimatedValueBase), 278500);
  const opportunityId = opportunity.body.data.id as string;

  const repriced = await request(app)
    .patch(`/api/v1/opportunities/${opportunityId}`)
    .set(auth)
    .send({ estimatedValue: "2.0000" });
  assert.equal(repriced.status, 200, JSON.stringify(repriced.body));
  assert.equal(repriced.body.data.currencyCode, "USD");
  assert.equal(Number(repriced.body.data.estimatedValueBase), 557);
  assert.equal(Number(repriced.body.data.exchangeRateToBase), 278.5);

  const formOptions = await request(app).get("/api/v1/opportunities/form-options").set(auth);
  assert.equal(formOptions.status, 200);
  assert.ok(Array.isArray(formOptions.body.data.stages));

  // --- Product interest ---
  const interest = await request(app)
    .post(`/api/v1/opportunities/${opportunityId}/products`)
    .set(auth)
    .send({ productId: product.body.data.id, quantity: "2", estimatedUnitAmount: "500.0000" });
  assert.equal(interest.status, 201, JSON.stringify(interest.body));

  const dupInterest = await request(app)
    .post(`/api/v1/opportunities/${opportunityId}/products`)
    .set(auth)
    .send({ productId: product.body.data.id });
  assert.equal(dupInterest.status, 409, JSON.stringify(dupInterest.body));

  const interests = await request(app).get(`/api/v1/opportunities/${opportunityId}/products`).set(auth);
  assert.equal(interests.status, 200);
  assert.equal(interests.body.data.length, 1);

  // --- Stage change preserves probability unless a stage default is requested ---
  const staged = await request(app)
    .post(`/api/v1/opportunities/${opportunityId}/stage`)
    .set(auth)
    .send({ stage: "NEGOTIATION", probabilityPercent: 65 });
  assert.equal(staged.status, 200, JSON.stringify(staged.body));
  assert.equal(staged.body.data.probabilityPercent, 65);

  // --- WON is blocked until a customer is linked ---
  const wonBeforeConvert = await request(app).post(`/api/v1/opportunities/${opportunityId}/won`).set(auth).send({});
  assert.equal(wonBeforeConvert.status, 400, JSON.stringify(wonBeforeConvert.body));

  // --- Convert the prospect into a brand-new customer, inside a single transaction ---
  const converted = await request(app)
    .post(`/api/v1/opportunities/${opportunityId}/convert`)
    .set(auth)
    .send({
      mode: "CREATE",
      customer: {
        customerType: "COMPANY",
        legalName: "Northwind Prospect LLC",
        displayName: "Northwind Prospect",
        countryCode: "PK",
        currencyCode: "PKR",
      },
    });
  assert.equal(converted.status, 200, JSON.stringify(converted.body));
  assert.ok(converted.body.data.customerId);
  // Prospect fields are preserved even after conversion.
  assert.equal(converted.body.data.prospectDisplayName, "Northwind Prospect");

  const won = await request(app).post(`/api/v1/opportunities/${opportunityId}/won`).set(auth).send({});
  assert.equal(won.status, 200, JSON.stringify(won.body));
  assert.equal(won.body.data.stage, "WON");
  assert.equal(won.body.data.probabilityPercent, 65);

  const stageAfterWon = await request(app)
    .post(`/api/v1/opportunities/${opportunityId}/stage`)
    .set(auth)
    .send({ stage: "PROPOSAL" });
  assert.equal(stageAfterWon.status, 400, JSON.stringify(stageAfterWon.body));

  const reopened = await request(app).post(`/api/v1/opportunities/${opportunityId}/reopen`).set(auth).send({});
  assert.equal(reopened.status, 200, JSON.stringify(reopened.body));
  assert.equal(reopened.body.data.stage, "NEGOTIATION");
  assert.equal(reopened.body.data.probabilityPercent, 65);
  assert.equal(reopened.body.data.lostReason, null);
  assert.equal(reopened.body.data.lostAt, null);
  assert.equal(reopened.body.data.wonAt, null);
  assert.equal(reopened.body.data.closedAt, null);
  assert.ok(reopened.body.data.reopenedAt);

  // --- A second opportunity exercises LOST and soft delete/restore ---
  const secondOpportunity = await request(app)
    .post("/api/v1/opportunities")
    .set(auth)
    .send({
      title: "Lost deal",
      currencyCode: "PKR",
      estimatedValue: "50000.0000",
      probabilityPercent: 40,
      prospectDisplayName: "Another Prospect",
    });
  assert.equal(secondOpportunity.status, 201, JSON.stringify(secondOpportunity.body));
  const secondId = secondOpportunity.body.data.id as string;

  const lost = await request(app)
    .post(`/api/v1/opportunities/${secondId}/lost`)
    .set(auth)
    .send({ lostReason: "PRICE", lostReasonDetail: "Lost to a cheaper competitor" });
  assert.equal(lost.status, 200, JSON.stringify(lost.body));
  assert.equal(lost.body.data.stage, "LOST");
  assert.equal(lost.body.data.probabilityPercent, 40);
  assert.equal(lost.body.data.lostReason, "PRICE");

  const deleted = await request(app).delete(`/api/v1/opportunities/${secondId}`).set(auth);
  assert.equal(deleted.status, 200);

  const restored = await request(app).post(`/api/v1/opportunities/${secondId}/restore`).set(auth);
  assert.equal(restored.status, 200);

  // --- Listing and audit ---
  const list = await request(app).get("/api/v1/opportunities").query({ stage: "LOST", limit: 20 }).set(auth);
  assert.equal(list.status, 200);
  assert.ok(list.body.data.items.some((row: { id: string }) => row.id === secondId));

  const audit = await request(app).get(`/api/v1/opportunities/${opportunityId}/audit`).set(auth);
  assert.equal(audit.status, 200);
  const actions = (audit.body.data.items as Array<{ action: string }>).map((event) => event.action);
  for (const action of ["opportunities.created", "opportunities.converted", "opportunities.won", "opportunities.reopened"]) {
    assert.ok(actions.includes(action), `missing audit action ${action}`);
  }

  const duplicateEmail = `dup-${Date.now()}@example.com`;
  const existingCustomer = await request(app).post("/api/v1/customers").set(auth).send({
    customerType: "COMPANY",
    legalName: "Existing Northwind",
    displayName: "Existing Northwind",
    email: duplicateEmail,
    countryCode: "PK",
    currencyCode: "PKR",
  });
  assert.equal(existingCustomer.status, 201, JSON.stringify(existingCustomer.body));
  const duplicateProspect = await request(app)
    .post("/api/v1/opportunities")
    .set(auth)
    .send({
      title: "Duplicate prospect",
      currencyCode: "PKR",
      prospectDisplayName: "Existing Northwind",
      prospectEmail: duplicateEmail,
    });
  assert.equal(duplicateProspect.status, 201, JSON.stringify(duplicateProspect.body));
  const duplicateConvert = await request(app)
    .post(`/api/v1/opportunities/${duplicateProspect.body.data.id}/convert`)
    .set(auth)
    .send({
      mode: "CREATE",
      customer: {
        customerType: "COMPANY",
        legalName: "Should Not Create",
        displayName: "Should Not Create",
        countryCode: "PK",
        currencyCode: "PKR",
      },
    });
  assert.equal(duplicateConvert.status, 409, JSON.stringify(duplicateConvert.body));

  const missingRate = await request(app).post("/api/v1/opportunities").set(auth).send({
    title: "No rate",
    currencyCode: "JPY",
    prospectDisplayName: "No Rate Co",
  });
  assert.equal(missingRate.status, 400, JSON.stringify(missingRate.body));

  console.log(
    JSON.stringify(
      {
        ok: true,
        opportunityNumber: opportunity.body.data.opportunityNumber,
        estimatedValueBase: opportunity.body.data.estimatedValueBase,
        wonStage: won.body.data.stage,
        reopenedStage: reopened.body.data.stage,
        lostStage: lost.body.data.stage,
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
