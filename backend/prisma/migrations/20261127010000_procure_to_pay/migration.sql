DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'purchase_order_status') THEN
    CREATE TYPE "purchase_order_status" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'BILLED', 'CLOSED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'goods_receipt_status') THEN
    CREATE TYPE "goods_receipt_status" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'vendor_bill_status') THEN
    CREATE TYPE "vendor_bill_status" AS ENUM ('DRAFT', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'VOID');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'vendor_payment_status') THEN
    CREATE TYPE "vendor_payment_status" AS ENUM ('DRAFT', 'PAID', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'vendor_payment_method') THEN
    CREATE TYPE "vendor_payment_method" AS ENUM ('BANK_TRANSFER', 'CASH', 'CHECK', 'CHEQUE', 'MOBILE_WALLET', 'ONLINE', 'OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'inventory_movement_type') THEN
    CREATE TYPE "inventory_movement_type" AS ENUM ('PURCHASE_RECEIPT', 'PURCHASE_RETURN', 'ADJUSTMENT', 'PURCHASE', 'SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN', 'RETURN_OUT', 'TRANSFER_IN', 'TRANSFER_OUT');
  END IF;
END
$$;

ALTER TYPE "document_type" ADD VALUE IF NOT EXISTS 'GOODS_RECEIPT';
ALTER TYPE "document_type" ADD VALUE IF NOT EXISTS 'VENDOR_PAYMENT';

CREATE TABLE IF NOT EXISTS "purchase_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "purchase_order_number" VARCHAR(32) NOT NULL,
    "vendor_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "status" "purchase_order_status" NOT NULL DEFAULT 'DRAFT',
    "order_date" DATE NOT NULL,
    "expected_delivery_date" DATE,
    "vendor_reference" VARCHAR(120),
    "currency_code" CHAR(3) NOT NULL,
    "exchange_rate_to_base" DECIMAL(19, 8),
    "base_currency_code" CHAR(3),
    "payment_term_id" UUID,
    "subtotal" DECIMAL(19, 4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19, 4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19, 4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19, 4) NOT NULL DEFAULT 0,
    "total_base" DECIMAL(19, 4),
    "amount_received" DECIMAL(19, 4) NOT NULL DEFAULT 0,
    "amount_billed" DECIMAL(19, 4) NOT NULL DEFAULT 0,
    "notes" VARCHAR(4000),
    "terms" VARCHAR(4000),
    "approved_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "received_at" TIMESTAMPTZ(6),
    "billed_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_order_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "product_id" UUID,
    "product_code" VARCHAR(64),
    "product_name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "unit_of_measure" VARCHAR(32),
    "quantity" DECIMAL(19, 4) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(19, 4) NOT NULL,
    "discount_percent" DECIMAL(7, 4) NOT NULL DEFAULT 0,
    "tax_code_id" UUID,
    "tax_code" VARCHAR(32),
    "tax_rate" DECIMAL(7, 4) NOT NULL DEFAULT 0,
    "line_subtotal" DECIMAL(19, 4) NOT NULL,
    "line_discount" DECIMAL(19, 4) NOT NULL,
    "line_tax" DECIMAL(19, 4) NOT NULL,
    "line_total" DECIMAL(19, 4) NOT NULL,
    "received_quantity" DECIMAL(19, 4) NOT NULL DEFAULT 0,
    "billed_quantity" DECIMAL(19, 4) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "goods_receipts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "receipt_number" VARCHAR(32) NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "status" "goods_receipt_status" NOT NULL DEFAULT 'DRAFT',
    "receipt_date" DATE NOT NULL,
    "vendor_reference" VARCHAR(120),
    "currency_code" CHAR(3) NOT NULL,
    "notes" VARCHAR(4000),
    "posted_at" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "goods_receipt_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "goods_receipt_id" UUID NOT NULL,
    "purchase_order_line_id" UUID NOT NULL,
    "product_id" UUID,
    "product_code" VARCHAR(64),
    "product_name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "unit_of_measure" VARCHAR(32),
    "ordered_quantity" DECIMAL(19, 4) NOT NULL,
    "received_quantity" DECIMAL(19, 4) NOT NULL,
    "unit_cost" DECIMAL(19, 4) NOT NULL,
    "line_total" DECIMAL(19, 4) NOT NULL,
    "location" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vendor_bills" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "bill_number" VARCHAR(32) NOT NULL,
    "purchase_order_id" UUID,
    "vendor_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "status" "vendor_bill_status" NOT NULL DEFAULT 'DRAFT',
    "bill_date" DATE NOT NULL,
    "due_date" DATE,
    "vendor_reference" VARCHAR(120),
    "currency_code" CHAR(3) NOT NULL,
    "exchange_rate_to_base" DECIMAL(19, 8),
    "base_currency_code" CHAR(3),
    "payment_term_id" UUID,
    "expense_account" VARCHAR(120),
    "liability_account" VARCHAR(120),
    "subtotal" DECIMAL(19, 4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19, 4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19, 4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19, 4) NOT NULL DEFAULT 0,
    "total_base" DECIMAL(19, 4),
    "amount_paid" DECIMAL(19, 4) NOT NULL DEFAULT 0,
    "notes" VARCHAR(4000),
    "approved_at" TIMESTAMPTZ(6),
    "billed_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "voided_at" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_bills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vendor_bill_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "bill_id" UUID NOT NULL,
    "product_id" UUID,
    "product_code" VARCHAR(64),
    "product_name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "unit_of_measure" VARCHAR(32),
    "quantity" DECIMAL(19, 4) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(19, 4) NOT NULL,
    "discount_percent" DECIMAL(7, 4) NOT NULL DEFAULT 0,
    "tax_code_id" UUID,
    "tax_code" VARCHAR(32),
    "tax_rate" DECIMAL(7, 4) NOT NULL DEFAULT 0,
    "line_subtotal" DECIMAL(19, 4) NOT NULL,
    "line_discount" DECIMAL(19, 4) NOT NULL,
    "line_tax" DECIMAL(19, 4) NOT NULL,
    "line_total" DECIMAL(19, 4) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_bill_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vendor_payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "payment_number" VARCHAR(32) NOT NULL,
    "vendor_id" UUID NOT NULL,
    "paid_date" DATE NOT NULL,
    "method" "vendor_payment_method" NOT NULL,
    "amount" DECIMAL(19, 4) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "reference" VARCHAR(120),
    "notes" VARCHAR(4000),
    "status" "vendor_payment_status" NOT NULL DEFAULT 'DRAFT',
    "bank_account" VARCHAR(120),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vendor_payment_allocations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "bill_id" UUID NOT NULL,
    "amount" DECIMAL(19, 4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_movements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "movement_type" "inventory_movement_type" NOT NULL,
    "quantity" DECIMAL(19, 4) NOT NULL,
    "unit_cost" DECIMAL(19, 4) NOT NULL,
    "location" VARCHAR(120) NOT NULL,
    "reference_type" VARCHAR(64) NOT NULL,
    "reference_id" UUID NOT NULL,
    "balance_after" DECIMAL(19, 4) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_balances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "location" VARCHAR(120) NOT NULL,
    "quantity" DECIMAL(19, 4) NOT NULL DEFAULT 0,
    "average_cost" DECIMAL(19, 4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_organization_id_purchase_order_number_key" ON "purchase_orders"("organization_id", "purchase_order_number");
CREATE INDEX IF NOT EXISTS "purchase_orders_organization_id_created_at_id_idx" ON "purchase_orders"("organization_id", "created_at", "id");
CREATE INDEX IF NOT EXISTS "purchase_orders_organization_id_status_created_at_idx" ON "purchase_orders"("organization_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "purchase_orders_organization_id_vendor_id_created_at_idx" ON "purchase_orders"("organization_id", "vendor_id", "created_at");
CREATE INDEX IF NOT EXISTS "purchase_orders_organization_id_owner_user_id_status_idx" ON "purchase_orders"("organization_id", "owner_user_id", "status");
CREATE INDEX IF NOT EXISTS "purchase_orders_organization_id_order_date_idx" ON "purchase_orders"("organization_id", "order_date");

CREATE INDEX IF NOT EXISTS "purchase_order_lines_organization_id_purchase_order_id_sort_order_idx" ON "purchase_order_lines"("organization_id", "purchase_order_id", "sort_order");

CREATE UNIQUE INDEX IF NOT EXISTS "goods_receipts_organization_id_receipt_number_key" ON "goods_receipts"("organization_id", "receipt_number");
CREATE INDEX IF NOT EXISTS "goods_receipts_organization_id_created_at_id_idx" ON "goods_receipts"("organization_id", "created_at", "id");
CREATE INDEX IF NOT EXISTS "goods_receipts_organization_id_status_created_at_idx" ON "goods_receipts"("organization_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "goods_receipts_organization_id_purchase_order_id_idx" ON "goods_receipts"("organization_id", "purchase_order_id");
CREATE INDEX IF NOT EXISTS "goods_receipts_organization_id_vendor_id_receipt_date_idx" ON "goods_receipts"("organization_id", "vendor_id", "receipt_date");

CREATE INDEX IF NOT EXISTS "goods_receipt_lines_organization_id_goods_receipt_id_sort_order_idx" ON "goods_receipt_lines"("organization_id", "goods_receipt_id", "sort_order");
CREATE INDEX IF NOT EXISTS "goods_receipt_lines_organization_id_purchase_order_line_id_idx" ON "goods_receipt_lines"("organization_id", "purchase_order_line_id");

CREATE UNIQUE INDEX IF NOT EXISTS "vendor_bills_organization_id_bill_number_key" ON "vendor_bills"("organization_id", "bill_number");
CREATE INDEX IF NOT EXISTS "vendor_bills_organization_id_created_at_id_idx" ON "vendor_bills"("organization_id", "created_at", "id");
CREATE INDEX IF NOT EXISTS "vendor_bills_organization_id_status_created_at_idx" ON "vendor_bills"("organization_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "vendor_bills_organization_id_vendor_id_created_at_idx" ON "vendor_bills"("organization_id", "vendor_id", "created_at");
CREATE INDEX IF NOT EXISTS "vendor_bills_organization_id_purchase_order_id_idx" ON "vendor_bills"("organization_id", "purchase_order_id");
CREATE INDEX IF NOT EXISTS "vendor_bills_organization_id_due_date_idx" ON "vendor_bills"("organization_id", "due_date");

CREATE INDEX IF NOT EXISTS "vendor_bill_lines_organization_id_bill_id_sort_order_idx" ON "vendor_bill_lines"("organization_id", "bill_id", "sort_order");

CREATE UNIQUE INDEX IF NOT EXISTS "vendor_payments_organization_id_payment_number_key" ON "vendor_payments"("organization_id", "payment_number");
CREATE INDEX IF NOT EXISTS "vendor_payments_organization_id_created_at_id_idx" ON "vendor_payments"("organization_id", "created_at", "id");
CREATE INDEX IF NOT EXISTS "vendor_payments_organization_id_status_created_at_idx" ON "vendor_payments"("organization_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "vendor_payments_organization_id_vendor_id_paid_date_idx" ON "vendor_payments"("organization_id", "vendor_id", "paid_date");

CREATE INDEX IF NOT EXISTS "vendor_payment_allocations_organization_id_payment_id_idx" ON "vendor_payment_allocations"("organization_id", "payment_id");
CREATE INDEX IF NOT EXISTS "vendor_payment_allocations_organization_id_bill_id_idx" ON "vendor_payment_allocations"("organization_id", "bill_id");

CREATE INDEX IF NOT EXISTS "inventory_movements_organization_id_created_at_id_idx" ON "inventory_movements"("organization_id", "created_at", "id");
CREATE INDEX IF NOT EXISTS "inventory_movements_organization_id_product_id_created_at_idx" ON "inventory_movements"("organization_id", "product_id", "created_at");
CREATE INDEX IF NOT EXISTS "inventory_movements_organization_id_movement_type_created_at_idx" ON "inventory_movements"("organization_id", "movement_type", "created_at");
CREATE INDEX IF NOT EXISTS "inventory_movements_organization_id_location_created_at_idx" ON "inventory_movements"("organization_id", "location", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_balances_organization_id_product_id_location_key" ON "inventory_balances"("organization_id", "product_id", "location");
CREATE INDEX IF NOT EXISTS "inventory_balances_organization_id_location_idx" ON "inventory_balances"("organization_id", "location");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_organization_id_fkey') THEN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_vendor_id_fkey') THEN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_owner_user_id_fkey') THEN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_currency_code_fkey') THEN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_payment_term_id_fkey') THEN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_payment_term_id_fkey" FOREIGN KEY ("payment_term_id") REFERENCES "payment_terms"("id") ON UPDATE CASCADE ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_created_by_id_fkey') THEN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_updated_by_id_fkey') THEN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_lines_organization_id_fkey') THEN ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_lines_purchase_order_id_fkey') THEN ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON UPDATE CASCADE ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_lines_product_id_fkey') THEN ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON UPDATE CASCADE ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_lines_tax_code_id_fkey') THEN ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON UPDATE CASCADE ON DELETE SET NULL; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goods_receipts_organization_id_fkey') THEN ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goods_receipts_purchase_order_id_fkey') THEN ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goods_receipts_vendor_id_fkey') THEN ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goods_receipts_currency_code_fkey') THEN ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goods_receipts_created_by_id_fkey') THEN ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goods_receipts_updated_by_id_fkey') THEN ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goods_receipt_lines_organization_id_fkey') THEN ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goods_receipt_lines_goods_receipt_id_fkey') THEN ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON UPDATE CASCADE ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goods_receipt_lines_purchase_order_line_id_fkey') THEN ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_purchase_order_line_id_fkey" FOREIGN KEY ("purchase_order_line_id") REFERENCES "purchase_order_lines"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goods_receipt_lines_product_id_fkey') THEN ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON UPDATE CASCADE ON DELETE SET NULL; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_bills_organization_id_fkey') THEN ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_bills_purchase_order_id_fkey') THEN ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_bills_vendor_id_fkey') THEN ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_bills_owner_user_id_fkey') THEN ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_bills_currency_code_fkey') THEN ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_bills_payment_term_id_fkey') THEN ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_payment_term_id_fkey" FOREIGN KEY ("payment_term_id") REFERENCES "payment_terms"("id") ON UPDATE CASCADE ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_bills_created_by_id_fkey') THEN ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_bills_updated_by_id_fkey') THEN ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_bill_lines_organization_id_fkey') THEN ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_bill_lines_bill_id_fkey') THEN ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "vendor_bills"("id") ON UPDATE CASCADE ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_bill_lines_product_id_fkey') THEN ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON UPDATE CASCADE ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_bill_lines_tax_code_id_fkey') THEN ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON UPDATE CASCADE ON DELETE SET NULL; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_payments_organization_id_fkey') THEN ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_payments_vendor_id_fkey') THEN ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_payments_currency_code_fkey') THEN ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_payments_created_by_id_fkey') THEN ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_payments_updated_by_id_fkey') THEN ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_payment_allocations_organization_id_fkey') THEN ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_payment_allocations_payment_id_fkey') THEN ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "vendor_payments"("id") ON UPDATE CASCADE ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_payment_allocations_bill_id_fkey') THEN ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "vendor_bills"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_organization_id_fkey') THEN ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_product_id_fkey') THEN ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_created_by_id_fkey') THEN ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_balances_organization_id_fkey') THEN ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_balances_product_id_fkey') THEN ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON UPDATE CASCADE ON DELETE RESTRICT; END IF;
END
$$;
