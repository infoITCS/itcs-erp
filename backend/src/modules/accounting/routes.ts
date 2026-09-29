import { Router } from "express";
import type { AccountingController } from "./controller";

export function createAccountingRouter(_controller: AccountingController): Router {
  return Router();
}
