import { Router } from "express";
import type { InventoryController } from "./controller";

export function createInventoryRouter(_controller: InventoryController): Router {
  return Router();
}
