import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { OrganizationsController } from "./controller";

export function createOrganizationsRouter(controller: OrganizationsController): Router {
  const router = Router();
  router.get("/", authenticate, requirePermission("organizations:read"), controller.list);
  return router;
}
