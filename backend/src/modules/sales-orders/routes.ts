import { Router } from "express";
import type { SalesOrdersController } from "./controller";

export function createSalesOrdersRouter(_controller: SalesOrdersController): Router {
  return Router();
}
