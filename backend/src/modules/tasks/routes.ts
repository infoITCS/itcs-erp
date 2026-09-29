import { Router } from "express";
import type { TasksController } from "./controller";

export function createTasksRouter(_controller: TasksController): Router {
  return Router();
}
