import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { RolesController } from "./controller";
import {
  createRoleSchema,
  roleIdParamSchema,
  updateRoleSchema,
} from "./validation";

export function createRolesRouter(controller: RolesController): Router {
  const router = Router();
  router.use(authenticate);
  router.get("/", requirePermission("roles:read"), controller.list);
  router.post(
    "/",
    requirePermission("roles:create"),
    validate({ body: createRoleSchema }),
    controller.create,
  );
  router.get(
    "/:id",
    requirePermission("roles:read"),
    validate({ params: roleIdParamSchema }),
    controller.get,
  );
  router.patch(
    "/:id",
    requirePermission("roles:update"),
    validate({ params: roleIdParamSchema, body: updateRoleSchema }),
    controller.update,
  );
  router.delete(
    "/:id",
    requirePermission("roles:delete"),
    validate({ params: roleIdParamSchema }),
    controller.delete,
  );
  return router;
}
