-- AlterEnum
ALTER TYPE "document_type" ADD VALUE 'LEAD';

-- CreateEnum
CREATE TYPE "lead_status" AS ENUM (
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'UNQUALIFIED',
  'CONVERTED',
  'WON'
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lead_number" VARCHAR(32) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "company_name" VARCHAR(200),
    "job_title" VARCHAR(120),
    "email" VARCHAR(320),
    "phone" VARCHAR(40),
    "website" VARCHAR(200),
    "country_code" CHAR(2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "source" "customer_lead_source" NOT NULL,
    "status" "lead_status" NOT NULL DEFAULT 'NEW',
    "priority" "customer_priority" NOT NULL DEFAULT 'NORMAL',
    "estimated_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "owner_user_id" UUID NOT NULL,
    "next_action" VARCHAR(500),
    "next_action_due_at" TIMESTAMPTZ(6),
    "description" VARCHAR(4000),
    "notes" VARCHAR(4000),
    "qualified_at" TIMESTAMPTZ(6),
    "unqualified_at" TIMESTAMPTZ(6),
    "unqualified_reason" VARCHAR(500),
    "converted_at" TIMESTAMPTZ(6),
    "won_at" TIMESTAMPTZ(6),
    "converted_customer_id" UUID,
    "converted_contact_id" UUID,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN "lead_id" UUID;

-- CreateIndex
CREATE INDEX "leads_organization_id_created_at_id_idx" ON "leads"("organization_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "leads_organization_id_status_created_at_idx" ON "leads"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "leads_organization_id_source_created_at_idx" ON "leads"("organization_id", "source", "created_at");

-- CreateIndex
CREATE INDEX "leads_organization_id_owner_user_id_status_idx" ON "leads"("organization_id", "owner_user_id", "status");

-- CreateIndex
CREATE INDEX "leads_organization_id_email_idx" ON "leads"("organization_id", "email");

-- CreateIndex
CREATE INDEX "leads_organization_id_next_action_due_at_idx" ON "leads"("organization_id", "next_action_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "leads_org_number_active_key"
  ON "leads" ("organization_id", "lead_number")
  WHERE "deleted_at" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_lead_id_key" ON "opportunities"("lead_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_customer_id_fkey" FOREIGN KEY ("converted_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_contact_id_fkey" FOREIGN KEY ("converted_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "leads_number_trgm" ON "leads" USING gin ("lead_number" gin_trgm_ops);
CREATE INDEX "leads_display_name_trgm" ON "leads" USING gin ("display_name" gin_trgm_ops);
CREATE INDEX "leads_company_name_trgm" ON "leads" USING gin ("company_name" gin_trgm_ops);
CREATE INDEX "leads_email_trgm" ON "leads" USING gin ("email" gin_trgm_ops);
