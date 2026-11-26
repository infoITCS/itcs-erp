import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { InventoryController } from "./controller";
import { createAdjustmentSchema, movementQuerySchema, stockQuerySchema } from "./validation";

export function createInventoryRouter(controller: InventoryController): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/stock", requirePermission("inventory:read"), validate({ query: stockQuerySchema }), controller.stock);
  router.get(
    "/movements",
    requirePermission("inventory:read"),
    validate({ query: movementQuerySchema }),
    controller.movements,
  );
  router.get("/form-options", requirePermission("inventory:read"), controller.formOptions);
  router.post(
    "/adjustments",
    requirePermission("inventory:manage"),
    validate({ body: createAdjustmentSchema }),
    controller.adjust,
  );

  return router;
}
