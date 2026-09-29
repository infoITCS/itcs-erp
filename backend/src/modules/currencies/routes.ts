import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { CurrenciesController } from "./controller";
import { createExchangeRateSchema, exchangeRateQuerySchema } from "./validation";

export function createCurrenciesRouter(controller: CurrenciesController): Router {
  const router = Router();
  router.use(authenticate);
  router.get("/", requirePermission("currencies:read"), controller.list);
  router.get(
    "/exchange-rates",
    requirePermission("currencies:read"),
    validate({ query: exchangeRateQuerySchema }),
    controller.rate,
  );
  router.post(
    "/exchange-rates",
    requirePermission("currencies:manage"),
    validate({ body: createExchangeRateSchema }),
    controller.createRate,
  );
  return router;
}
