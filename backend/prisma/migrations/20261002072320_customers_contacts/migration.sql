-- CreateEnum
CREATE TYPE "customer_type" AS ENUM ('COMPANY', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "customer_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "address_purpose" AS ENUM ('BILLING', 'SHIPPING');

-- CreateEnum
CREATE TYPE "contact_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterEnum
ALTER TYPE "document_type" ADD VALUE 'CUSTOMER';

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_number" VARCHAR(32) NOT NULL,
    "customer_type" "customer_type" NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(320),
    "phone" VARCHAR(40),
    "website" VARCHAR(200),
    "country_code" CHAR(2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "tax_number" VARCHAR(64),
    "status" "customer_status" NOT NULL DEFAULT 'ACTIVE',
    "notes" VARCHAR(4000),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
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

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
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

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_organization_id_created_at_id_idx" ON "customers"("organization_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "customers_organization_id_status_created_at_idx" ON "customers"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "customers_organization_id_customer_type_created_at_idx" ON "customers"("organization_id", "customer_type", "created_at");

-- CreateIndex
CREATE INDEX "customers_organization_id_country_code_created_at_idx" ON "customers"("organization_id", "country_code", "created_at");

-- CreateIndex
CREATE INDEX "customers_organization_id_currency_code_idx" ON "customers"("organization_id", "currency_code");

-- CreateIndex
CREATE INDEX "customer_addresses_organization_id_customer_id_purpose_idx" ON "customer_addresses"("organization_id", "customer_id", "purpose");

-- CreateIndex
CREATE INDEX "contacts_organization_id_customer_id_created_at_id_idx" ON "contacts"("organization_id", "customer_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "contacts_organization_id_email_idx" ON "contacts"("organization_id", "email");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Trigram search and partial uniqueness cannot be expressed in schema.prisma.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE UNIQUE INDEX "customers_org_number_active_key"
  ON "customers" ("organization_id", "customer_number")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "customer_addresses_one_primary_key"
  ON "customer_addresses" ("customer_id", "purpose")
  WHERE "is_primary" = true AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "contacts_one_primary_key"
  ON "contacts" ("customer_id")
  WHERE "is_primary" = true AND "deleted_at" IS NULL;

CREATE INDEX "customers_number_trgm" ON "customers" USING gin ("customer_number" gin_trgm_ops);
CREATE INDEX "customers_legal_name_trgm" ON "customers" USING gin ("legal_name" gin_trgm_ops);
CREATE INDEX "customers_display_name_trgm" ON "customers" USING gin ("display_name" gin_trgm_ops);
CREATE INDEX "customers_email_trgm" ON "customers" USING gin ("email" gin_trgm_ops);
CREATE INDEX "customers_phone_trgm" ON "customers" USING gin ("phone" gin_trgm_ops);
