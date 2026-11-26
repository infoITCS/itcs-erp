DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'vendor_status') THEN
    CREATE TYPE "vendor_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "vendors" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "vendor_number" VARCHAR(32) NOT NULL,
    "code" VARCHAR(64),
    "name" VARCHAR(200) NOT NULL,
    "legal_name" VARCHAR(200),
    "display_name" VARCHAR(200),
    "status" "vendor_status" NOT NULL DEFAULT 'ACTIVE',
    "vendor_type" VARCHAR(64),
    "category" VARCHAR(100),
    "currency_code" CHAR(3) NOT NULL,
    "payment_term_id" UUID,
    "tax_code_id" UUID,
    "tax_id" VARCHAR(120),
    "registration_number" VARCHAR(120),
    "website" VARCHAR(500),
    "email" VARCHAR(320),
    "phone" VARCHAR(60),
    "address_line1" VARCHAR(255),
    "address_line2" VARCHAR(255),
    "city" VARCHAR(120),
    "state_province" VARCHAR(120),
    "postal_code" VARCHAR(120),
    "country_code" VARCHAR(8),
    "bank_account" VARCHAR(255),
    "notes" VARCHAR(4000),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vendors_organization_id_vendor_number_key" ON "vendors"("organization_id", "vendor_number");
CREATE INDEX IF NOT EXISTS "vendors_organization_id_created_at_id_idx" ON "vendors"("organization_id", "created_at", "id");
CREATE INDEX IF NOT EXISTS "vendors_organization_id_status_created_at_idx" ON "vendors"("organization_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "vendors_organization_id_name_idx" ON "vendors"("organization_id", "name");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendors_organization_id_fkey') THEN
    ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendors_currency_code_fkey') THEN
    ALTER TABLE "vendors" ADD CONSTRAINT "vendors_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendors_payment_term_id_fkey') THEN
    ALTER TABLE "vendors" ADD CONSTRAINT "vendors_payment_term_id_fkey" FOREIGN KEY ("payment_term_id") REFERENCES "payment_terms"("id") ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendors_tax_code_id_fkey') THEN
    ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendors_created_by_id_fkey') THEN
    ALTER TABLE "vendors" ADD CONSTRAINT "vendors_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendors_updated_by_id_fkey') THEN
    ALTER TABLE "vendors" ADD CONSTRAINT "vendors_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END
$$;
