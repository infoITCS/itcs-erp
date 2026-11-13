import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { OrganizationsController } from "./controller";
import {
  organizationIdParamSchema,
  updateOrganizationSchema,
} from "./validation";

export function createOrganizationsRouter(controller: OrganizationsController): Router {
  const router = Router();
  router.use(authenticate);
  router.get("/", requirePermission("organizations:read"), controller.list);
  router.patch(
    "/:id",
    requirePermission("organizations:update"),
    validate({ params: organizationIdParamSchema, body: updateOrganizationSchema }),
    controller.update,
  );
  router.delete(
    "/:id",
    requirePermission("organizations:delete"),
    validate({ params: organizationIdParamSchema }),
    controller.remove,
  );
  return router;
}
