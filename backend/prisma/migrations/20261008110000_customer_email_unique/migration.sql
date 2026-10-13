DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "customers"
    WHERE "deleted_at" IS NULL AND "email" IS NOT NULL
    GROUP BY "organization_id", lower(btrim("email"))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce customer email uniqueness: active duplicate emails already exist. Resolve duplicates, then retry this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX "customers_org_email_active_key"
  ON "customers" ("organization_id", lower(btrim("email")))
  WHERE "deleted_at" IS NULL AND "email" IS NOT NULL;
