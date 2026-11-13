import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import type { AnalyticsController } from "./controller";
import { analyticsQuerySchema } from "./validation";

export function createAnalyticsRouter(controller: AnalyticsController): Router {
  const router = Router();
  router.use(authenticate);
  router.get("/", validate({ query: analyticsQuerySchema }), controller.get);
  return router;
}
