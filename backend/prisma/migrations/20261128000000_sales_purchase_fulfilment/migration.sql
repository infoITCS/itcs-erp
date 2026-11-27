ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "cogs_total" DECIMAL(19, 4) NOT NULL DEFAULT 0;

ALTER TABLE "sales_order_lines" ADD COLUMN IF NOT EXISTS "fulfilled_quantity" DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE "sales_order_lines" ADD COLUMN IF NOT EXISTS "cogs_amount" DECIMAL(19, 4) NOT NULL DEFAULT 0;

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cogs_total" DECIMAL(19, 4) NOT NULL DEFAULT 0;

ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "cogs_amount" DECIMAL(19, 4) NOT NULL DEFAULT 0;

ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "source_sales_order_id" UUID;

ALTER TABLE "purchase_order_lines" ADD COLUMN IF NOT EXISTS "source_sales_order_line_id" UUID;

CREATE INDEX IF NOT EXISTS "purchase_orders_organization_id_source_sales_order_id_idx" ON "purchase_orders"("organization_id", "source_sales_order_id");
CREATE INDEX IF NOT EXISTS "purchase_order_lines_organization_id_source_sales_order_line_id_idx" ON "purchase_order_lines"("organization_id", "source_sales_order_line_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_source_sales_order_id_fkey') THEN
    ALTER TABLE "purchase_orders"
      ADD CONSTRAINT "purchase_orders_source_sales_order_id_fkey"
      FOREIGN KEY ("source_sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_lines_source_sales_order_line_id_fkey') THEN
    ALTER TABLE "purchase_order_lines"
      ADD CONSTRAINT "purchase_order_lines_source_sales_order_line_id_fkey"
      FOREIGN KEY ("source_sales_order_line_id") REFERENCES "sales_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
