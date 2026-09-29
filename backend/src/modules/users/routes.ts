import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { UsersController } from "./controller";
import {
  createUserSchema,
  updateUserStatusSchema,
  userIdParamSchema,
  userListQuerySchema,
} from "./validation";

export function createUsersRouter(controller: UsersController): Router {
  const router = Router();
  router.use(authenticate);
  router.get("/", requirePermission("users:read"), validate({ query: userListQuerySchema }), controller.list);
  router.post("/", requirePermission("users:create"), validate({ body: createUserSchema }), controller.create);
  router.get("/:id", requirePermission("users:read"), validate({ params: userIdParamSchema }), controller.get);
  router.patch(
    "/:id/status",
    requirePermission("users:update"),
    validate({ params: userIdParamSchema, body: updateUserStatusSchema }),
    controller.updateStatus,
  );
  return router;
}
