import { Router } from "express";
import type { ContactsController } from "./controller";

export function createContactsRouter(_controller: ContactsController): Router {
  return Router();
}
