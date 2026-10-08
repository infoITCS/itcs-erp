import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { ContactsController } from "./controller";
import { contactIdParamSchema, contactListQuerySchema, updateContactSchema } from "./validation";

export function createContactsRouter(controller: ContactsController): Router {
  const router = Router();
  router.use(authenticate);
  router.get("/", requirePermission("customers:read"), validate({ query: contactListQuerySchema }), controller.list);
  router.get("/:id", requirePermission("customers:read"), validate({ params: contactIdParamSchema }), controller.get);
  router.patch(
    "/:id",
    requirePermission("contacts:update"),
    validate({ params: contactIdParamSchema, body: updateContactSchema }),
    controller.update,
  );
  router.delete(
    "/:id",
    requirePermission("contacts:delete"),
    validate({ params: contactIdParamSchema }),
    controller.remove,
  );
  router.post(
    "/:id/restore",
    requirePermission("contacts:restore"),
    validate({ params: contactIdParamSchema }),
    controller.restore,
  );
  return router;
}
