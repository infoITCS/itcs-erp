import { Router } from "express";
import type { PurchasingController } from "./controller";

export function createPurchasingRouter(_controller: PurchasingController): Router {
  return Router();
}
