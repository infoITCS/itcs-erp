-- AlterEnum
ALTER TYPE "document_type" ADD VALUE 'PRODUCT';

-- CreateEnum
CREATE TYPE "product_type" AS ENUM ('PHYSICAL_PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "product_price_type" AS ENUM ('SALES', 'PURCHASE');

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "parent_id" UUID,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_codes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "rate" DECIMAL(7,4) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tax_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(4000),
    "product_type" "product_type" NOT NULL,
    "status" "product_status" NOT NULL DEFAULT 'ACTIVE',
    "category_id" UUID,
    "unit_of_measure_id" UUID NOT NULL,
    "tax_code_id" UUID,
    "track_inventory" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(4000),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_prices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "price_type" "product_price_type" NOT NULL,
    "price_list_code" VARCHAR(32) NOT NULL DEFAULT 'STANDARD',
    "currency_code" CHAR(3) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "effective_date" DATE NOT NULL,
    "expiry_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_organization_id_code_key" ON "units_of_measure"("organization_id", "code");

-- CreateIndex
CREATE INDEX "product_categories_organization_id_parent_id_idx" ON "product_categories"("organization_id", "parent_id");

-- CreateIndex
CREATE INDEX "product_categories_organization_id_created_at_id_idx" ON "product_categories"("organization_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_codes_organization_id_code_key" ON "tax_codes"("organization_id", "code");

-- CreateIndex
CREATE INDEX "products_organization_id_created_at_id_idx" ON "products"("organization_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "products_organization_id_status_created_at_idx" ON "products"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "products_organization_id_product_type_created_at_idx" ON "products"("organization_id", "product_type", "created_at");

-- CreateIndex
CREATE INDEX "products_organization_id_category_id_created_at_idx" ON "products"("organization_id", "category_id", "created_at");

-- CreateIndex
CREATE INDEX "products_organization_id_track_inventory_idx" ON "products"("organization_id", "track_inventory");

-- CreateIndex
CREATE INDEX "product_prices_organization_id_product_id_price_type_effect_idx" ON "product_prices"("organization_id", "product_id", "price_type", "effective_date");

-- CreateIndex
CREATE INDEX "product_prices_organization_id_price_list_code_currency_cod_idx" ON "product_prices"("organization_id", "price_list_code", "currency_code");

-- AddForeignKey
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_codes" ADD CONSTRAINT "tax_codes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial uniqueness and trigram search cannot be expressed in schema.prisma.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE UNIQUE INDEX "products_org_code_active_key"
  ON "products" ("organization_id", "code")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "product_categories_org_code_active_key"
  ON "product_categories" ("organization_id", "code")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "product_prices_live_key"
  ON "product_prices" ("organization_id", "product_id", "price_type", "price_list_code", "currency_code", "effective_date")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "products_code_trgm" ON "products" USING gin ("code" gin_trgm_ops);
CREATE INDEX "products_name_trgm" ON "products" USING gin ("name" gin_trgm_ops);
CREATE INDEX "product_categories_code_trgm" ON "product_categories" USING gin ("code" gin_trgm_ops);
CREATE INDEX "product_categories_name_trgm" ON "product_categories" USING gin ("name" gin_trgm_ops);
