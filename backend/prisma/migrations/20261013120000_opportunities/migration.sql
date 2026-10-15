-- AlterEnum
ALTER TYPE "document_type" ADD VALUE 'OPPORTUNITY';

-- CreateEnum
CREATE TYPE "opportunity_stage" AS ENUM (
  'NEW',
  'QUALIFICATION',
  'NEEDS_ANALYSIS',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST'
);

-- CreateEnum
CREATE TYPE "opportunity_lost_reason" AS ENUM (
  'PRICE',
  'COMPETITOR',
  'NO_BUDGET',
  'NO_DECISION',
  'TIMING',
  'SCOPE_MISMATCH',
  'INTERNAL',
  'OTHER'
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "opportunity_number" VARCHAR(32) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(4000),
    "stage" "opportunity_stage" NOT NULL DEFAULT 'NEW',
    "customer_id" UUID,
    "contact_id" UUID,
    "reseller_id" UUID,
    "owner_user_id" UUID NOT NULL,
    "lead_source" "customer_lead_source",
    "estimated_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" CHAR(3) NOT NULL,
    "exchange_rate_to_base" DECIMAL(19,8),
    "estimated_value_base" DECIMAL(19,4),
    "base_currency_code" CHAR(3),
    "probability_percent" INTEGER NOT NULL DEFAULT 10,
    "expected_close_date" DATE,
    "next_action" VARCHAR(500),
    "next_action_due_at" TIMESTAMPTZ(6),
    "lost_reason" "opportunity_lost_reason",
    "lost_reason_detail" VARCHAR(500),
    "competitor_name" VARCHAR(200),
    "won_at" TIMESTAMPTZ(6),
    "lost_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "reopened_at" TIMESTAMPTZ(6),
    "prospect_display_name" VARCHAR(200),
    "prospect_legal_name" VARCHAR(200),
    "prospect_email" VARCHAR(320),
    "prospect_phone" VARCHAR(40),
    "prospect_country_code" CHAR(2),
    "notes" VARCHAR(4000),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_product_interests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL DEFAULT 1,
    "estimated_unit_amount" DECIMAL(19,4),
    "product_code" VARCHAR(64) NOT NULL,
    "product_name" VARCHAR(200) NOT NULL,
    "notes" VARCHAR(1000),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "opportunity_product_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opportunities_organization_id_created_at_id_idx" ON "opportunities"("organization_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "opportunities_organization_id_stage_expected_close_date_idx" ON "opportunities"("organization_id", "stage", "expected_close_date");

-- CreateIndex
CREATE INDEX "opportunities_organization_id_owner_user_id_stage_idx" ON "opportunities"("organization_id", "owner_user_id", "stage");

-- CreateIndex
CREATE INDEX "opportunities_organization_id_customer_id_created_at_idx" ON "opportunities"("organization_id", "customer_id", "created_at");

-- CreateIndex
CREATE INDEX "opportunities_organization_id_reseller_id_created_at_idx" ON "opportunities"("organization_id", "reseller_id", "created_at");

-- CreateIndex
CREATE INDEX "opportunities_organization_id_lead_source_created_at_idx" ON "opportunities"("organization_id", "lead_source", "created_at");

-- CreateIndex
CREATE INDEX "opportunities_organization_id_expected_close_date_idx" ON "opportunities"("organization_id", "expected_close_date");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_org_number_active_key"
  ON "opportunities" ("organization_id", "opportunity_number")
  WHERE "deleted_at" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_product_interests_opportunity_id_product_id_key" ON "opportunity_product_interests"("opportunity_id", "product_id");

-- CreateIndex
CREATE INDEX "opportunity_product_interests_organization_id_opportunity_id_sort_order_idx" ON "opportunity_product_interests"("organization_id", "opportunity_id", "sort_order");

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_reseller_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_product_interests" ADD CONSTRAINT "opportunity_product_interests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_product_interests" ADD CONSTRAINT "opportunity_product_interests_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_product_interests" ADD CONSTRAINT "opportunity_product_interests_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_product_interests" ADD CONSTRAINT "opportunity_product_interests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "opportunities_title_trgm" ON "opportunities" USING gin ("title" gin_trgm_ops);
CREATE INDEX "opportunities_number_trgm" ON "opportunities" USING gin ("opportunity_number" gin_trgm_ops);
CREATE INDEX "opportunities_prospect_name_trgm" ON "opportunities" USING gin ("prospect_display_name" gin_trgm_ops);
CREATE INDEX "opportunities_prospect_email_trgm" ON "opportunities" USING gin ("prospect_email" gin_trgm_ops);
