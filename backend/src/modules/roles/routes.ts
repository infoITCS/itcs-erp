import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { RolesController } from "./controller";

export function createRolesRouter(controller: RolesController): Router {
  const router = Router();
  router.get("/", authenticate, requirePermission("roles:read"), controller.list);
  return router;
}
