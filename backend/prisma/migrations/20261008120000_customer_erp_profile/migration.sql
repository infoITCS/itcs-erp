-- Add new values without removing legacy customer types; existing API records remain valid.
ALTER TYPE "customer_type" ADD VALUE IF NOT EXISTS 'B2B';
ALTER TYPE "customer_type" ADD VALUE IF NOT EXISTS 'B2C';
ALTER TYPE "customer_type" ADD VALUE IF NOT EXISTS 'WHOLESALE';
ALTER TYPE "customer_status" ADD VALUE IF NOT EXISTS 'HOLD';

CREATE TYPE "customer_lead_source" AS ENUM (
  'WEBSITE', 'REFERRAL', 'COLD_CALL', 'SOCIAL_MEDIA', 'ADVERTISEMENT', 'PARTNER', 'TENDER', 'OTHER'
);
CREATE TYPE "customer_tax_id_type" AS ENUM ('NTN', 'STRN', 'OTHER');
CREATE TYPE "contact_method" AS ENUM ('EMAIL', 'PHONE', 'SMS');
CREATE TYPE "customer_contact_role" AS ENUM ('BILLING', 'PROCUREMENT', 'FINANCE', 'OPERATIONS', 'SALES', 'OTHER');
CREATE TYPE "customer_pricing_group_type" AS ENUM ('PRICING_TIER', 'DISCOUNT_GROUP');
CREATE TYPE "customer_note_type" AS ENUM ('GENERAL', 'BILLING', 'SUPPORT', 'INTERNAL');
CREATE TYPE "customer_activity_type" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'TASK', 'SITE_VISIT', 'OTHER');
CREATE TYPE "support_ticket_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');
CREATE TYPE "support_ticket_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "customer_document_type" AS ENUM ('NDA', 'TAX_CERTIFICATE', 'CONTRACT', 'PURCHASE_ORDER', 'OTHER');

ALTER TABLE "customers"
  ADD COLUMN "industry" VARCHAR(120),
  ADD COLUMN "lead_source" "customer_lead_source",
  ADD COLUMN "assigned_sales_rep_id" UUID,
  ADD COLUMN "tax_id_type" "customer_tax_id_type",
  ADD COLUMN "tax_exempt" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "credit_limit" DECIMAL(19, 4) NOT NULL DEFAULT 0,
  ADD COLUMN "payment_term_id" UUID,
  ADD COLUMN "pricing_group_id" UUID,
  ADD COLUMN "opening_balance" DECIMAL(19, 4) NOT NULL DEFAULT 0,
  ADD COLUMN "opening_balance_date" DATE,
  ADD CONSTRAINT "customers_credit_limit_nonnegative_check" CHECK ("credit_limit" >= 0);

ALTER TABLE "customer_addresses"
  ADD COLUMN "latitude" DECIMAL(9, 6),
  ADD COLUMN "longitude" DECIMAL(9, 6),
  ADD COLUMN "geofence_radius_meters" INTEGER,
  ADD CONSTRAINT "customer_addresses_coordinates_pair_check"
    CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
  ADD CONSTRAINT "customer_addresses_latitude_range_check"
    CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "customer_addresses_longitude_range_check"
    CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "customer_addresses_geofence_radius_positive_check"
    CHECK ("geofence_radius_meters" IS NULL OR "geofence_radius_meters" > 0);

ALTER TABLE "contacts"
  ADD COLUMN "preferred_contact_method" "contact_method",
  ADD COLUMN "email_opt_in" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "phone_opt_in" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sms_opt_in" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "payment_terms" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "due_days" INTEGER NOT NULL DEFAULT 0,
  "discount_days" INTEGER NOT NULL DEFAULT 0,
  "discount_percent" DECIMAL(7, 4),
  "requires_prepayment" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "payment_terms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_terms_due_days_nonnegative_check" CHECK ("due_days" >= 0),
  CONSTRAINT "payment_terms_discount_days_nonnegative_check" CHECK ("discount_days" >= 0),
  CONSTRAINT "payment_terms_discount_percent_range_check"
    CHECK ("discount_percent" IS NULL OR "discount_percent" BETWEEN 0 AND 100)
);

CREATE TABLE "customer_pricing_groups" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "group_type" "customer_pricing_group_type" NOT NULL,
  "discount_percent" DECIMAL(7, 4),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "customer_pricing_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_pricing_groups_discount_percent_range_check"
    CHECK ("discount_percent" IS NULL OR "discount_percent" BETWEEN 0 AND 100)
);

CREATE TABLE "customer_contact_role_assignments" (
  "id" UUID NOT NULL,
  "contact_id" UUID NOT NULL,
  "role" "customer_contact_role" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_contact_role_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_notes" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "note_type" "customer_note_type" NOT NULL DEFAULT 'GENERAL',
  "content" TEXT NOT NULL,
  "is_private" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" UUID NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_activities" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "activity_type" "customer_activity_type" NOT NULL,
  "subject" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_support_tickets" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "ticket_number" VARCHAR(32) NOT NULL,
  "subject" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "status" "support_ticket_status" NOT NULL DEFAULT 'OPEN',
  "priority" "support_ticket_priority" NOT NULL DEFAULT 'NORMAL',
  "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(6),
  "closed_at" TIMESTAMPTZ(6),
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "customer_support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_documents" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "document_type" "customer_document_type" NOT NULL,
  "display_name" VARCHAR(160) NOT NULL,
  "original_file_name" VARCHAR(255) NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "sha256" CHAR(64),
  "uploaded_by_id" UUID NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_documents_size_nonnegative_check" CHECK ("size_bytes" >= 0)
);

CREATE UNIQUE INDEX "payment_terms_organization_id_code_key" ON "payment_terms"("organization_id", "code");
CREATE INDEX "payment_terms_organization_id_is_active_idx" ON "payment_terms"("organization_id", "is_active");
CREATE UNIQUE INDEX "customer_pricing_groups_organization_id_code_key" ON "customer_pricing_groups"("organization_id", "code");
CREATE INDEX "customer_pricing_groups_organization_id_group_type_is_active_idx" ON "customer_pricing_groups"("organization_id", "group_type", "is_active");
CREATE UNIQUE INDEX "customer_contact_role_assignments_contact_id_role_key" ON "customer_contact_role_assignments"("contact_id", "role");
CREATE INDEX "customer_contact_role_assignments_role_contact_id_idx" ON "customer_contact_role_assignments"("role", "contact_id");
CREATE INDEX "customer_notes_organization_id_customer_id_created_at_idx" ON "customer_notes"("organization_id", "customer_id", "created_at");
CREATE INDEX "customer_activities_organization_id_customer_id_occurred_at_idx" ON "customer_activities"("organization_id", "customer_id", "occurred_at");
CREATE UNIQUE INDEX "customer_support_tickets_organization_id_ticket_number_key" ON "customer_support_tickets"("organization_id", "ticket_number");
CREATE INDEX "customer_support_tickets_organization_id_customer_id_status_opened_at_idx" ON "customer_support_tickets"("organization_id", "customer_id", "status", "opened_at");
CREATE UNIQUE INDEX "customer_documents_organization_id_storage_key_key" ON "customer_documents"("organization_id", "storage_key");
CREATE INDEX "customer_documents_organization_id_customer_id_document_type_created_at_idx" ON "customer_documents"("organization_id", "customer_id", "document_type", "created_at");
CREATE INDEX "customers_organization_id_assigned_sales_rep_id_status_idx" ON "customers"("organization_id", "assigned_sales_rep_id", "status");
CREATE INDEX "customers_organization_id_payment_term_id_idx" ON "customers"("organization_id", "payment_term_id");
CREATE INDEX "customers_organization_id_pricing_group_id_idx" ON "customers"("organization_id", "pricing_group_id");

ALTER TABLE "payment_terms" ADD CONSTRAINT "payment_terms_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_pricing_groups" ADD CONSTRAINT "customer_pricing_groups_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_contact_role_assignments" ADD CONSTRAINT "customer_contact_role_assignments_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_support_tickets" ADD CONSTRAINT "customer_support_tickets_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_support_tickets" ADD CONSTRAINT "customer_support_tickets_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_support_tickets" ADD CONSTRAINT "customer_support_tickets_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_support_tickets" ADD CONSTRAINT "customer_support_tickets_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_documents" ADD CONSTRAINT "customer_documents_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_documents" ADD CONSTRAINT "customer_documents_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_documents" ADD CONSTRAINT "customer_documents_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_sales_rep_id_fkey"
  FOREIGN KEY ("assigned_sales_rep_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_payment_term_id_fkey"
  FOREIGN KEY ("payment_term_id") REFERENCES "payment_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_pricing_group_id_fkey"
  FOREIGN KEY ("pricing_group_id") REFERENCES "customer_pricing_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
