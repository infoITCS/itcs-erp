import { Router } from "express";
import type { QuotesController } from "./controller";

export function createQuotesRouter(_controller: QuotesController): Router {
  return Router();
}
