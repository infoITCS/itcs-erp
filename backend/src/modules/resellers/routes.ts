import { Router } from "express";
import type { ResellersController } from "./controller";

export function createResellersRouter(_controller: ResellersController): Router {
  return Router();
}
