import { Router } from "express";
import type { NotificationsController } from "./controller";

export function createNotificationsRouter(_controller: NotificationsController): Router {
  return Router();
}
