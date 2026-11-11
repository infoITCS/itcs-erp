import { Router } from "express";
import { listQuerySchema } from "../../common/pagination/list-query";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { InvoicesController } from "./controller";
import {
  changeInvoiceStatusSchema,
  createInvoiceSchema,
  invoiceIdParamSchema,
  invoiceListQuerySchema,
  updateInvoiceSchema,
} from "./validation";

export function createInvoicesRouter(controller: InvoicesController): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", requirePermission("invoices:read"), validate({ query: invoiceListQuerySchema }), controller.list);
  router.get("/form-options", requirePermission("invoices:read"), controller.formOptions);
  router.post(
    "/",
    requirePermission("invoices:create"),
    validate({ body: createInvoiceSchema }),
    controller.create,
  );

  router.get("/:id", requirePermission("invoices:read"), validate({ params: invoiceIdParamSchema }), controller.get);
  router.patch(
    "/:id",
    requirePermission("invoices:update"),
    validate({ params: invoiceIdParamSchema, body: updateInvoiceSchema }),
    controller.update,
  );
  router.delete(
    "/:id",
    requirePermission("invoices:delete"),
    validate({ params: invoiceIdParamSchema }),
    controller.remove,
  );
  router.post(
    "/:id/restore",
    requirePermission("invoices:restore"),
    validate({ params: invoiceIdParamSchema }),
    controller.restore,
  );
  router.post(
    "/:id/status",
    requirePermission("invoices:update"),
    validate({ params: invoiceIdParamSchema, body: changeInvoiceStatusSchema }),
    controller.changeStatus,
  );
  router.get(
    "/:id/audit",
    requirePermission("invoices:read"),
    validate({ params: invoiceIdParamSchema, query: listQuerySchema }),
    controller.listAudit,
  );

  return router;
}
