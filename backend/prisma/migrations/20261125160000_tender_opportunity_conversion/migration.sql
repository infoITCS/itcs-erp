ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "tender_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "opportunities_tender_id_key" ON "opportunities"("tender_id");

CREATE INDEX IF NOT EXISTS "opportunities_organization_id_tender_id_created_at_idx" ON "opportunities"("organization_id", "tender_id", "created_at");

ALTER TABLE "opportunities"
ADD CONSTRAINT "opportunities_tender_id_fkey"
FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
