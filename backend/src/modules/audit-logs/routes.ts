import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { AuditLogsController } from "./controller";
import { auditListQuerySchema } from "./validation";

export function createAuditLogsRouter(controller: AuditLogsController): Router {
  const router = Router();
  router.get(
    "/",
    authenticate,
    requirePermission("audit-logs:read"),
    validate({ query: auditListQuerySchema }),
    controller.list,
  );
  return router;
}
