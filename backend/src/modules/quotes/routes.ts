import { Router } from "express";
import { listQuerySchema } from "../../common/pagination/list-query";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { QuotesController } from "./controller";
import {
  changeQuoteStatusSchema,
  convertQuoteSchema,
  createQuoteSchema,
  quoteIdParamSchema,
  quoteListQuerySchema,
  updateQuoteSchema,
} from "./validation";

export function createQuotesRouter(controller: QuotesController): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", requirePermission("quotes:read"), validate({ query: quoteListQuerySchema }), controller.list);
  router.get("/form-options", requirePermission("quotes:read"), controller.formOptions);
  router.post("/", requirePermission("quotes:create"), validate({ body: createQuoteSchema }), controller.create);

  router.get("/:id", requirePermission("quotes:read"), validate({ params: quoteIdParamSchema }), controller.get);
  router.patch(
    "/:id",
    requirePermission("quotes:update"),
    validate({ params: quoteIdParamSchema, body: updateQuoteSchema }),
    controller.update,
  );
  router.delete(
    "/:id",
    requirePermission("quotes:delete"),
    validate({ params: quoteIdParamSchema }),
    controller.remove,
  );
  router.post(
    "/:id/restore",
    requirePermission("quotes:restore"),
    validate({ params: quoteIdParamSchema }),
    controller.restore,
  );
  router.post(
    "/:id/status",
    requirePermission("quotes:update"),
    validate({ params: quoteIdParamSchema, body: changeQuoteStatusSchema }),
    controller.changeStatus,
  );
  router.post(
    "/:id/convert-to-order",
    requirePermission("sales-orders:create"),
    validate({ params: quoteIdParamSchema, body: convertQuoteSchema }),
    controller.convertToOrder,
  );
  router.get(
    "/:id/audit",
    requirePermission("quotes:read"),
    validate({ params: quoteIdParamSchema, query: listQuerySchema }),
    controller.listAudit,
  );

  return router;
}
