ALTER TYPE "document_type" ADD VALUE IF NOT EXISTS 'PROJECT';

CREATE TYPE "project_status" AS ENUM ('PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
CREATE TYPE "project_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "billing_mode" AS ENUM ('FIXED_PRICE', 'TIME_MATERIALS', 'RETAINER');

CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_number" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(4000),
    "customer_id" UUID,
    "sales_order_id" UUID,
    "owner_user_id" UUID NOT NULL,
    "status" "project_status" NOT NULL DEFAULT 'PLANNED',
    "priority" "project_priority" NOT NULL DEFAULT 'MEDIUM',
    "billing_mode" "billing_mode" NOT NULL DEFAULT 'TIME_MATERIALS',
    "currency_code" CHAR(3) NOT NULL,
    "contract_revenue" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "planned_budget" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "start_date" DATE,
    "end_date" DATE,
    "baseline_start" DATE,
    "baseline_end" DATE,
    "wip_limit" INTEGER,
    "notes" VARCHAR(4000),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "lead_id" UUID,
    "opportunity_id" UUID,
    "quote_id" UUID,
    "invoice_id" UUID,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "projects_organization_id_project_number_key" ON "projects"("organization_id", "project_number");
CREATE UNIQUE INDEX "projects_organization_id_sales_order_id_key" ON "projects"("organization_id", "sales_order_id");
CREATE UNIQUE INDEX "projects_organization_id_lead_id_key" ON "projects"("organization_id", "lead_id");
CREATE UNIQUE INDEX "projects_organization_id_opportunity_id_key" ON "projects"("organization_id", "opportunity_id");
CREATE UNIQUE INDEX "projects_organization_id_quote_id_key" ON "projects"("organization_id", "quote_id");
CREATE UNIQUE INDEX "projects_organization_id_invoice_id_key" ON "projects"("organization_id", "invoice_id");
CREATE INDEX "projects_organization_id_created_at_id_idx" ON "projects"("organization_id", "created_at", "id");
CREATE INDEX "projects_organization_id_status_created_at_idx" ON "projects"("organization_id", "status", "created_at");
CREATE INDEX "projects_organization_id_customer_id_created_at_idx" ON "projects"("organization_id", "customer_id", "created_at");
CREATE INDEX "projects_organization_id_owner_user_id_status_idx" ON "projects"("organization_id", "owner_user_id", "status");

ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "projects" ADD CONSTRAINT "projects_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "projects" ADD CONSTRAINT "projects_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "projects" ADD CONSTRAINT "projects_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "projects" ADD CONSTRAINT "projects_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "projects" ADD CONSTRAINT "projects_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "projects" ADD CONSTRAINT "projects_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "projects" ADD CONSTRAINT "projects_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON UPDATE CASCADE ON DELETE SET NULL;
