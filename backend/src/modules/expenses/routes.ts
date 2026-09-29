import { Router } from "express";
import type { ExpensesController } from "./controller";

export function createExpensesRouter(_controller: ExpensesController): Router {
  return Router();
}
