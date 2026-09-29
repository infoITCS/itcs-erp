import { Router } from "express";
import type { InvoicesController } from "./controller";

export function createInvoicesRouter(_controller: InvoicesController): Router {
  return Router();
}
