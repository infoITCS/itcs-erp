import { Router } from "express";
import type { DeliveriesController } from "./controller";

export function createDeliveriesRouter(_controller: DeliveriesController): Router {
  return Router();
}
