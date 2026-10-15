-- Backfill an opportunity counter for organizations that already exist.
-- The OPPORTUNITY enum value is added in the previous migration, so this insert
-- runs only after that value is committed.
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
    'OPPORTUNITY'::"document_type",
    'OPP',
    1,
    5,
    EXTRACT(YEAR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::int,
    CURRENT_TIMESTAMP
FROM "organizations" AS organization
WHERE NOT EXISTS (
    SELECT 1
    FROM "document_sequences" AS existing
    WHERE existing."organization_id" = organization."id"
      AND existing."document_type" = 'OPPORTUNITY'::"document_type"
      AND existing."year" = EXTRACT(YEAR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::int
);
