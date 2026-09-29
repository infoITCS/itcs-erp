import { Router } from "express";
import type { RenewalsController } from "./controller";

export function createRenewalsRouter(_controller: RenewalsController): Router {
  return Router();
}
