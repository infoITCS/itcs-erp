import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { VendorsController } from "./controller";
import { createVendorSchema, updateVendorSchema, vendorIdParamSchema, vendorListQuerySchema } from "./validation";

export function createVendorsRouter(controller: VendorsController): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", requirePermission("vendors:read"), validate({ query: vendorListQuerySchema }), controller.list);
  router.get("/form-options", requirePermission("vendors:read"), controller.formOptions);
  router.post("/", requirePermission("vendors:create"), validate({ body: createVendorSchema }), controller.create);
  router.post(
    "/:id/restore",
    requirePermission("vendors:restore"),
    validate({ params: vendorIdParamSchema }),
    controller.restore,
  );
  router.get("/:id", requirePermission("vendors:read"), validate({ params: vendorIdParamSchema }), controller.get);
  router.patch(
    "/:id",
    requirePermission("vendors:update"),
    validate({ params: vendorIdParamSchema, body: updateVendorSchema }),
    controller.update,
  );
  router.delete(
    "/:id",
    requirePermission("vendors:delete"),
    validate({ params: vendorIdParamSchema }),
    controller.remove,
  );

  return router;
}
