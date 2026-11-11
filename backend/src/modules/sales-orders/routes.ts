import { Router } from "express";
import { listQuerySchema } from "../../common/pagination/list-query";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { SalesOrdersController } from "./controller";
import {
  changeSalesOrderStatusSchema,
  convertSalesOrderSchema,
  createSalesOrderSchema,
  salesOrderIdParamSchema,
  salesOrderListQuerySchema,
  updateSalesOrderSchema,
} from "./validation";

export function createSalesOrdersRouter(controller: SalesOrdersController): Router {
  const router = Router();
  router.use(authenticate);

  router.get(
    "/",
    requirePermission("sales-orders:read"),
    validate({ query: salesOrderListQuerySchema }),
    controller.list,
  );
  router.get("/form-options", requirePermission("sales-orders:read"), controller.formOptions);
  router.post(
    "/",
    requirePermission("sales-orders:create"),
    validate({ body: createSalesOrderSchema }),
    controller.create,
  );

  router.get(
    "/:id",
    requirePermission("sales-orders:read"),
    validate({ params: salesOrderIdParamSchema }),
    controller.get,
  );
  router.patch(
    "/:id",
    requirePermission("sales-orders:update"),
    validate({ params: salesOrderIdParamSchema, body: updateSalesOrderSchema }),
    controller.update,
  );
  router.delete(
    "/:id",
    requirePermission("sales-orders:delete"),
    validate({ params: salesOrderIdParamSchema }),
    controller.remove,
  );
  router.post(
    "/:id/restore",
    requirePermission("sales-orders:restore"),
    validate({ params: salesOrderIdParamSchema }),
    controller.restore,
  );
  router.post(
    "/:id/status",
    requirePermission("sales-orders:update"),
    validate({ params: salesOrderIdParamSchema, body: changeSalesOrderStatusSchema }),
    controller.changeStatus,
  );
  router.post(
    "/:id/convert-to-invoice",
    requirePermission("invoices:create"),
    validate({ params: salesOrderIdParamSchema, body: convertSalesOrderSchema }),
    controller.convertToInvoice,
  );
  router.get(
    "/:id/audit",
    requirePermission("sales-orders:read"),
    validate({ params: salesOrderIdParamSchema, query: listQuerySchema }),
    controller.listAudit,
  );

  return router;
}
