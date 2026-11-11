import { Router } from "express";
import { listQuerySchema } from "../../common/pagination/list-query";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { PaymentsController } from "./controller";
import {
  createPaymentSchema,
  paymentIdParamSchema,
  paymentListQuerySchema,
  updatePaymentSchema,
} from "./validation";

export function createPaymentsRouter(controller: PaymentsController): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", requirePermission("payments:read"), validate({ query: paymentListQuerySchema }), controller.list);
  router.get("/form-options", requirePermission("payments:read"), controller.formOptions);
  router.post("/", requirePermission("payments:create"), validate({ body: createPaymentSchema }), controller.create);

  router.get("/:id", requirePermission("payments:read"), validate({ params: paymentIdParamSchema }), controller.get);
  router.patch(
    "/:id",
    requirePermission("payments:update"),
    validate({ params: paymentIdParamSchema, body: updatePaymentSchema }),
    controller.update,
  );
  router.delete(
    "/:id",
    requirePermission("payments:delete"),
    validate({ params: paymentIdParamSchema }),
    controller.remove,
  );
  router.get(
    "/:id/audit",
    requirePermission("payments:read"),
    validate({ params: paymentIdParamSchema, query: listQuerySchema }),
    controller.listAudit,
  );

  return router;
}
