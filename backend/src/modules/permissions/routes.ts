import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireAnyPermission } from "../../middleware/authorize";
import type { PermissionsController } from "./controller";

export function createPermissionsRouter(controller: PermissionsController): Router {
  const router = Router();
  router.get("/", authenticate, requireAnyPermission("permissions:read", "roles:read"), controller.list);
  return router;
}
