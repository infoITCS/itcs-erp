import { Router } from "express";
import type { TendersController } from "./controller";

export function createTendersRouter(_controller: TendersController): Router {
  return Router();
}
