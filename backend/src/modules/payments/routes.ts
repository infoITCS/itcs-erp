import { Router } from "express";
import type { PaymentsController } from "./controller";

export function createPaymentsRouter(_controller: PaymentsController): Router {
  return Router();
}
