-- CreateEnum
CREATE TYPE "tender_status" AS ENUM (
  'DRAFT',
  'OPEN',
  'SUBMITTED',
  'WON',
  'LOST',
  'CANCELLED'
);

-- CreateTable
CREATE TABLE "tenders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "tender_number" VARCHAR(32) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(4000),
    "reference_number" VARCHAR(120),
    "status" "tender_status" NOT NULL DEFAULT 'DRAFT',
    "customer_id" UUID NOT NULL,
    "contact_id" UUID,
    "owner_user_id" UUID NOT NULL,
    "estimated_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" CHAR(3) NOT NULL,
    "exchange_rate_to_base" DECIMAL(19,8),
    "estimated_value_base" DECIMAL(19,4),
    "base_currency_code" CHAR(3),
    "submission_deadline" TIMESTAMPTZ(6),
    "expected_award_date" DATE,
    "notes" VARCHAR(4000),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenders_organization_id_created_at_id_idx" ON "tenders"("organization_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "tenders_organization_id_status_submission_deadline_idx" ON "tenders"("organization_id", "status", "submission_deadline");

-- CreateIndex
CREATE INDEX "tenders_organization_id_customer_id_created_at_idx" ON "tenders"("organization_id", "customer_id", "created_at");

-- CreateIndex
CREATE INDEX "tenders_organization_id_owner_user_id_status_idx" ON "tenders"("organization_id", "owner_user_id", "status");

-- CreateIndex
CREATE INDEX "tenders_organization_id_submission_deadline_idx" ON "tenders"("organization_id", "submission_deadline");

-- CreateIndex
CREATE UNIQUE INDEX "tenders_org_number_active_key"
  ON "tenders" ("organization_id", "tender_number")
  WHERE "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "tenders_title_trgm" ON "tenders" USING gin ("title" gin_trgm_ops);
CREATE INDEX "tenders_number_trgm" ON "tenders" USING gin ("tender_number" gin_trgm_ops);
CREATE INDEX "tenders_reference_trgm" ON "tenders" USING gin ("reference_number" gin_trgm_ops);

-- Backfill a tender counter for organizations that already exist.
INSERT INTO "document_sequences" (
    "id",
    "organization_id",
    "document_type",
    "prefix",
    "next_number",
    "padding",
    "year",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    organization."id",
    'TENDER'::"document_type",
    'TND',
    1,
    5,
    EXTRACT(YEAR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::int,
    CURRENT_TIMESTAMP
FROM "organizations" AS organization
WHERE NOT EXISTS (
    SELECT 1
    FROM "document_sequences" AS existing
    WHERE existing."organization_id" = organization."id"
      AND existing."document_type" = 'TENDER'::"document_type"
      AND existing."year" = EXTRACT(YEAR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::int
);
