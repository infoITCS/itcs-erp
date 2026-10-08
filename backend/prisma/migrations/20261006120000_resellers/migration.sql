-- AlterEnum
ALTER TYPE "document_type" ADD VALUE 'RESELLER';

-- CreateEnum
CREATE TYPE "reseller_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "resellers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "reseller_number" VARCHAR(32) NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(320),
    "phone" VARCHAR(40),
    "website" VARCHAR(200),
    "country_code" CHAR(2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "tax_number" VARCHAR(64),
    "status" "reseller_status" NOT NULL DEFAULT 'ACTIVE',
    "price_list_code" VARCHAR(32) NOT NULL DEFAULT 'STANDARD',
    "default_discount_percent" DECIMAL(7,4),
    "default_commission_percent" DECIMAL(7,4),
    "notes" VARCHAR(4000),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "resellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reseller_addresses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "reseller_id" UUID NOT NULL,
    "purpose" "address_purpose" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "label" VARCHAR(80),
    "line1" VARCHAR(200) NOT NULL,
    "line2" VARCHAR(200),
    "city" VARCHAR(120) NOT NULL,
    "region" VARCHAR(120),
    "postal_code" VARCHAR(20),
    "country_code" CHAR(2) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reseller_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reseller_contacts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "reseller_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "job_title" VARCHAR(120),
    "department" VARCHAR(120),
    "email" VARCHAR(320),
    "phone" VARCHAR(40),
    "mobile" VARCHAR(40),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" "contact_status" NOT NULL DEFAULT 'ACTIVE',
    "notes" VARCHAR(4000),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reseller_contacts_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "reseller_id" UUID;

-- CreateIndex
CREATE INDEX "resellers_organization_id_created_at_id_idx" ON "resellers"("organization_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "resellers_organization_id_status_created_at_idx" ON "resellers"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "resellers_organization_id_country_code_created_at_idx" ON "resellers"("organization_id", "country_code", "created_at");

-- CreateIndex
CREATE INDEX "reseller_addresses_organization_id_reseller_id_purpose_idx" ON "reseller_addresses"("organization_id", "reseller_id", "purpose");

-- CreateIndex
CREATE INDEX "reseller_contacts_organization_id_reseller_id_created_at_id_idx" ON "reseller_contacts"("organization_id", "reseller_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "reseller_contacts_organization_id_email_idx" ON "reseller_contacts"("organization_id", "email");

-- CreateIndex
CREATE INDEX "customers_organization_id_reseller_id_created_at_idx" ON "customers"("organization_id", "reseller_id", "created_at");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_reseller_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resellers" ADD CONSTRAINT "resellers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resellers" ADD CONSTRAINT "resellers_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resellers" ADD CONSTRAINT "resellers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resellers" ADD CONSTRAINT "resellers_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_addresses" ADD CONSTRAINT "reseller_addresses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_addresses" ADD CONSTRAINT "reseller_addresses_reseller_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_addresses" ADD CONSTRAINT "reseller_addresses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_addresses" ADD CONSTRAINT "reseller_addresses_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_contacts" ADD CONSTRAINT "reseller_contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_contacts" ADD CONSTRAINT "reseller_contacts_reseller_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "resellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_contacts" ADD CONSTRAINT "reseller_contacts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_contacts" ADD CONSTRAINT "reseller_contacts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial uniqueness and trigram search cannot be expressed in schema.prisma.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE UNIQUE INDEX "resellers_org_number_active_key"
  ON "resellers" ("organization_id", "reseller_number")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "reseller_addresses_one_primary_key"
  ON "reseller_addresses" ("reseller_id", "purpose")
  WHERE "is_primary" = true AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "reseller_contacts_one_primary_key"
  ON "reseller_contacts" ("reseller_id")
  WHERE "is_primary" = true AND "deleted_at" IS NULL;

CREATE INDEX "resellers_number_trgm" ON "resellers" USING gin ("reseller_number" gin_trgm_ops);
CREATE INDEX "resellers_legal_name_trgm" ON "resellers" USING gin ("legal_name" gin_trgm_ops);
CREATE INDEX "resellers_display_name_trgm" ON "resellers" USING gin ("display_name" gin_trgm_ops);
CREATE INDEX "resellers_email_trgm" ON "resellers" USING gin ("email" gin_trgm_ops);
CREATE INDEX "resellers_phone_trgm" ON "resellers" USING gin ("phone" gin_trgm_ops);
