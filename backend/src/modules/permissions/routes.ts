import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { PermissionsController } from "./controller";

export function createPermissionsRouter(controller: PermissionsController): Router {
  const router = Router();
  router.get("/", authenticate, requirePermission("permissions:read"), controller.list);
  return router;
}
