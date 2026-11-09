-- Reconcile databases that applied an earlier, incompatible "leads" table
-- under the same migration name. The legacy table used full_name and had no
-- priority/source/qualification columns. It is empty, so replace it with the
-- schema this codebase expects while leaving already-correct databases intact.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'full_name'
  ) THEN
    IF (SELECT count(*) FROM "leads") = 0 THEN
      DROP TABLE "leads" CASCADE;
    ELSE
      RAISE EXCEPTION 'Legacy leads table contains rows. Migrate them manually before applying this reconciliation.';
    END IF;
  END IF;
END $$;

ALTER TYPE "lead_status" ADD VALUE IF NOT EXISTS 'WON';

CREATE TABLE IF NOT EXISTS "leads" (
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

CREATE INDEX IF NOT EXISTS "leads_organization_id_created_at_id_idx" ON "leads"("organization_id", "created_at", "id");
CREATE INDEX IF NOT EXISTS "leads_organization_id_status_created_at_idx" ON "leads"("organization_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "leads_organization_id_source_created_at_idx" ON "leads"("organization_id", "source", "created_at");
CREATE INDEX IF NOT EXISTS "leads_organization_id_owner_user_id_status_idx" ON "leads"("organization_id", "owner_user_id", "status");
CREATE INDEX IF NOT EXISTS "leads_organization_id_email_idx" ON "leads"("organization_id", "email");
CREATE INDEX IF NOT EXISTS "leads_organization_id_next_action_due_at_idx" ON "leads"("organization_id", "next_action_due_at");
CREATE UNIQUE INDEX IF NOT EXISTS "leads_org_number_active_key"
  ON "leads" ("organization_id", "lead_number")
  WHERE "deleted_at" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_organization_id_fkey') THEN
    ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_currency_code_fkey') THEN
    ALTER TABLE "leads" ADD CONSTRAINT "leads_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_owner_user_id_fkey') THEN
    ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_converted_customer_id_fkey') THEN
    ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_customer_id_fkey" FOREIGN KEY ("converted_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_converted_contact_id_fkey') THEN
    ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_contact_id_fkey" FOREIGN KEY ("converted_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_created_by_id_fkey') THEN
    ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_updated_by_id_fkey') THEN
    ALTER TABLE "leads" ADD CONSTRAINT "leads_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "lead_id" UUID;
CREATE UNIQUE INDEX IF NOT EXISTS "opportunities_lead_id_key" ON "opportunities"("lead_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunities_lead_id_fkey') THEN
    ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "leads_number_trgm" ON "leads" USING gin ("lead_number" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "leads_display_name_trgm" ON "leads" USING gin ("display_name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "leads_company_name_trgm" ON "leads" USING gin ("company_name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "leads_email_trgm" ON "leads" USING gin ("email" gin_trgm_ops);
