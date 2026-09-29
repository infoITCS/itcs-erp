import { Router } from "express";
import type { OpportunitiesController } from "./controller";

export function createOpportunitiesRouter(_controller: OpportunitiesController): Router {
  return Router();
}
