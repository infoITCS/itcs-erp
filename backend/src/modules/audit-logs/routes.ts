import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requireAdministrator, requirePermission } from "../../middleware/authorize";
import type { AuditLogsController } from "./controller";
import { auditListQuerySchema, auditRetentionBodySchema } from "./validation";

export function createAuditLogsRouter(controller: AuditLogsController): Router {
  const router = Router();
  router.get(
    "/retention",
    authenticate,
    requirePermission("audit-logs:read"),
    controller.getRetention,
  );
  router.patch(
    "/retention",
    authenticate,
    requirePermission("audit-logs:read"),
    requireAdministrator,
    validate({ body: auditRetentionBodySchema }),
    controller.updateRetention,
  );
  router.get(
    "/",
    authenticate,
    requirePermission("audit-logs:read"),
    validate({ query: auditListQuerySchema }),
    controller.list,
  );
  return router;
}
