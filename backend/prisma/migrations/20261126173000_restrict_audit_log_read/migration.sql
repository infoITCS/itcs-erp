DELETE FROM "role_permissions" AS rp
USING "roles" AS r, "permissions" AS p
WHERE rp."role_id" = r."id"
  AND rp."permission_id" = p."id"
  AND p."code" = 'audit-logs:read'
  AND r."is_system" = true
  AND r."code" IN ('executive', 'operations-manager', 'auditor', 'viewer');
