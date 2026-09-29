import { Router } from "express";
import type { ReportsController } from "./controller";

export function createReportsRouter(_controller: ReportsController): Router {
  return Router();
}
