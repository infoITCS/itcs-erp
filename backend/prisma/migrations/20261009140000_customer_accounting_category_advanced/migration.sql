-- CreateEnum
CREATE TYPE "customer_rating" AS ENUM ('HOT', 'WARM', 'COLD', 'MISCELLANEOUS');

-- CreateEnum
CREATE TYPE "customer_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "accounting_category_id" UUID,
ADD COLUMN     "customer_code" VARCHAR(32),
ADD COLUMN     "middle_name" VARCHAR(100),
ADD COLUMN     "prices_include_tax" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" "customer_priority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "rating" "customer_rating",
ADD COLUMN     "registration_number" VARCHAR(64);

-- CreateTable
CREATE TABLE "accounting_categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "accounting_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_categories_organization_id_is_active_idx" ON "accounting_categories"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_categories_organization_id_code_key" ON "accounting_categories"("organization_id", "code");

-- CreateIndex
CREATE INDEX "customers_organization_id_accounting_category_id_idx" ON "customers"("organization_id", "accounting_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_organization_id_customer_code_key" ON "customers"("organization_id", "customer_code");

-- AddForeignKey
ALTER TABLE "accounting_categories" ADD CONSTRAINT "accounting_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_accounting_category_id_fkey" FOREIGN KEY ("accounting_category_id") REFERENCES "accounting_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default accounting categories for every organization
WITH seed_categories(code, name) AS (
  VALUES
    ('LOCAL', 'Local'),
    ('REGIONAL', 'Regional'),
    ('EXPORT', 'Export')
)
INSERT INTO "accounting_categories" ("id", "organization_id", "code", "name", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), organization."id", category.code, category.name, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organizations" AS organization
CROSS JOIN seed_categories AS category
ON CONFLICT ("organization_id", "code") DO UPDATE
SET "name" = EXCLUDED."name",
    "is_active" = true,
    "updated_at" = CURRENT_TIMESTAMP;
