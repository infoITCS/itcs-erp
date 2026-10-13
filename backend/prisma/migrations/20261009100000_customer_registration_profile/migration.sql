CREATE TYPE "customer_entity_type" AS ENUM ('COMPANY', 'INDIVIDUAL');
CREATE TYPE "customer_category" AS ENUM ('RETAIL', 'WHOLESALE', 'CORPORATE', 'VIP', 'PARTNER', 'OTHER');
CREATE TYPE "customer_incorporation_status" AS ENUM ('REGISTERED', 'PENDING', 'UNREGISTERED', 'NOT_APPLICABLE');
CREATE TYPE "customer_identity_document_type" AS ENUM ('CNIC', 'PASSPORT');
CREATE TYPE "customer_payment_method" AS ENUM ('BANK_TRANSFER', 'CASH', 'CARD', 'CHEQUE', 'MOBILE_WALLET', 'OTHER');
CREATE TYPE "customer_communication_channel" AS ENUM ('EMAIL', 'PHONE', 'SMS', 'WHATSAPP');

ALTER TABLE "customers"
  ADD COLUMN "entity_type" "customer_entity_type" NOT NULL DEFAULT 'COMPANY',
  ADD COLUMN "customer_category" "customer_category",
  ADD COLUMN "employee_count" INTEGER,
  ADD COLUMN "incorporation_status" "customer_incorporation_status",
  ADD COLUMN "business_registration_date" DATE,
  ADD COLUMN "same_as_billing" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "tax_exemption_code" VARCHAR(64),
  ADD COLUMN "default_tax_code_id" UUID,
  ADD COLUMN "identity_document_type" "customer_identity_document_type",
  ADD COLUMN "identity_document_number" VARCHAR(40),
  ADD COLUMN "email_marketing_opt_in" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "credit_hold" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "preferred_payment_method" "customer_payment_method",
  ADD COLUMN "preferred_communication_channel" "customer_communication_channel",
  ADD CONSTRAINT "customers_employee_count_nonnegative_check" CHECK ("employee_count" IS NULL OR "employee_count" >= 0),
  ADD CONSTRAINT "customers_default_tax_code_id_fkey" FOREIGN KEY ("default_tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "customers"
SET "entity_type" = 'INDIVIDUAL'
WHERE "customer_type" = 'INDIVIDUAL';

UPDATE "customers"
SET "customer_category" = 'WHOLESALE'
WHERE "customer_type" = 'WHOLESALE';

CREATE INDEX "customers_organization_id_default_tax_code_id_idx"
  ON "customers"("organization_id", "default_tax_code_id");