import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import type { DashboardController } from "./controller";

export function createDashboardRouter(controller: DashboardController): Router {
  const router = Router();
  router.use(authenticate);
  router.get("/", controller.get);
  return router;
}
