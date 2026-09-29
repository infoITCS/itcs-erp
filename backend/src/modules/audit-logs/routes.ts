import { Router } from "express";
import { listQuerySchema } from "../../common/pagination/list-query";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { AuditLogsController } from "./controller";

export function createAuditLogsRouter(controller: AuditLogsController): Router {
  const router = Router();
  router.get(
    "/",
    authenticate,
    requirePermission("audit-logs:read"),
    validate({ query: listQuerySchema }),
    controller.list,
  );
  return router;
}
