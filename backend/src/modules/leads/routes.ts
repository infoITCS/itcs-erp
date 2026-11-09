import { Router } from "express";
import { listQuerySchema } from "../../common/pagination/list-query";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { LeadsController } from "./controller";
import {
  changeLeadStatusSchema,
  convertLeadSchema,
  createLeadSchema,
  leadAnalyticsQuerySchema,
  leadIdParamSchema,
  leadListQuerySchema,
  updateLeadSchema,
} from "./validation";

export function createLeadsRouter(controller: LeadsController): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", requirePermission("leads:read"), validate({ query: leadListQuerySchema }), controller.list);
  router.get(
    "/analytics",
    requirePermission("leads:read"),
    validate({ query: leadAnalyticsQuerySchema }),
    controller.analytics,
  );
  router.get("/form-options", requirePermission("leads:read"), controller.formOptions);
  router.post("/", requirePermission("leads:create"), validate({ body: createLeadSchema }), controller.create);

  router.get("/:id", requirePermission("leads:read"), validate({ params: leadIdParamSchema }), controller.get);
  router.patch(
    "/:id",
    requirePermission("leads:update"),
    validate({ params: leadIdParamSchema, body: updateLeadSchema }),
    controller.update,
  );
  router.delete(
    "/:id",
    requirePermission("leads:delete"),
    validate({ params: leadIdParamSchema }),
    controller.remove,
  );
  router.post(
    "/:id/restore",
    requirePermission("leads:restore"),
    validate({ params: leadIdParamSchema }),
    controller.restore,
  );

  router.post(
    "/:id/status",
    requirePermission("leads:update"),
    validate({ params: leadIdParamSchema, body: changeLeadStatusSchema }),
    controller.changeStatus,
  );
  router.post(
    "/:id/convert",
    requirePermission("leads:update"),
    validate({ params: leadIdParamSchema, body: convertLeadSchema }),
    controller.convert,
  );
  router.get(
    "/:id/audit",
    requirePermission("leads:read"),
    validate({ params: leadIdParamSchema, query: listQuerySchema }),
    controller.listAudit,
  );

  return router;
}
