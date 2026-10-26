import { Router } from "express";
import { listQuerySchema } from "../../common/pagination/list-query";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { TendersController } from "./controller";
import {
  createTenderSchema,
  tenderIdParamSchema,
  tenderListQuerySchema,
  updateTenderSchema,
} from "./validation";

export function createTendersRouter(controller: TendersController): Router {
  const router = Router();
  router.use(authenticate);

  router.get(
    "/",
    requirePermission("tenders:read"),
    validate({ query: tenderListQuerySchema }),
    controller.list,
  );
  router.get("/form-options", requirePermission("tenders:read"), controller.formOptions);
  router.post("/", requirePermission("tenders:create"), validate({ body: createTenderSchema }), controller.create);

  router.get(
    "/:id",
    requirePermission("tenders:read"),
    validate({ params: tenderIdParamSchema }),
    controller.get,
  );
  router.patch(
    "/:id",
    requirePermission("tenders:update"),
    validate({ params: tenderIdParamSchema, body: updateTenderSchema }),
    controller.update,
  );
  router.delete(
    "/:id",
    requirePermission("tenders:delete"),
    validate({ params: tenderIdParamSchema }),
    controller.remove,
  );
  router.post(
    "/:id/restore",
    requirePermission("tenders:restore"),
    validate({ params: tenderIdParamSchema }),
    controller.restore,
  );
  router.get(
    "/:id/audit",
    requirePermission("tenders:read"),
    validate({ params: tenderIdParamSchema, query: listQuerySchema }),
    controller.listAudit,
  );

  return router;
}
