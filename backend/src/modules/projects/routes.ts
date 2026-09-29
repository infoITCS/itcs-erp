import { Router } from "express";
import type { ProjectsController } from "./controller";

export function createProjectsRouter(_controller: ProjectsController): Router {
  return Router();
}
