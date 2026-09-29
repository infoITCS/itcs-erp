import { Router } from "express";
import type { VendorsController } from "./controller";

export function createVendorsRouter(_controller: VendorsController): Router {
  return Router();
}
