import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { UsersController } from "./controller";
import {
  createUserSchema,
  resetUserPasswordSchema,
  updateUserSchema,
  updateUserStatusSchema,
  userIdParamSchema,
  userListQuerySchema,
} from "./validation";

export function createUsersRouter(controller: UsersController): Router {
  const router = Router();
  router.use(authenticate);
  router.get("/", requirePermission("users:read"), validate({ query: userListQuerySchema }), controller.list);
  router.get("/stats", requirePermission("users:read"), controller.stats);
  router.post("/", requirePermission("users:create"), validate({ body: createUserSchema }), controller.create);
  router.get("/:id", requirePermission("users:read"), validate({ params: userIdParamSchema }), controller.get);
  router.patch(
    "/:id",
    requirePermission("users:update"),
    validate({ params: userIdParamSchema, body: updateUserSchema }),
    controller.update,
  );
  router.patch(
    "/:id/status",
    requirePermission("users:update"),
    validate({ params: userIdParamSchema, body: updateUserStatusSchema }),
    controller.updateStatus,
  );
  router.post(
    "/:id/reset-password",
    requirePermission("users:update"),
    validate({ params: userIdParamSchema, body: resetUserPasswordSchema }),
    controller.resetPassword,
  );
  router.delete(
    "/:id",
    requirePermission("users:delete"),
    validate({ params: userIdParamSchema }),
    controller.deactivate,
  );
  return router;
}
