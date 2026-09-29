import { Router } from "express";
import type { CustomersController } from "./controller";

export function createCustomersRouter(_controller: CustomersController): Router {
  return Router();
}
