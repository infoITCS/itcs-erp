import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { ResellersController } from "./controller";
import {
  addressIdParamSchema,
  addressInputSchema,
  contactBodySchema,
  contactIdParamSchema,
  contactListQuerySchema,
  createResellerSchema,
  customerAssignParamSchema,
  resellerIdParamSchema,
  resellerListQuerySchema,
  updateContactSchema,
  updateResellerSchema,
} from "./validation";

export function createResellersRouter(controller: ResellersController): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", requirePermission("resellers:read"), validate({ query: resellerListQuerySchema }), controller.list);
  router.post("/", requirePermission("resellers:create"), validate({ body: createResellerSchema }), controller.create);

  router.get(
    "/:id/addresses",
    requirePermission("resellers:read"),
    validate({ params: resellerIdParamSchema }),
    controller.listAddresses,
  );
  router.post(
    "/:id/addresses",
    requirePermission("resellers:update"),
    validate({ params: resellerIdParamSchema, body: addressInputSchema }),
    controller.createAddress,
  );
  router.patch(
    "/:id/addresses/:addressId",
    requirePermission("resellers:update"),
    validate({ params: addressIdParamSchema, body: addressInputSchema }),
    controller.updateAddress,
  );
  router.delete(
    "/:id/addresses/:addressId",
    requirePermission("resellers:update"),
    validate({ params: addressIdParamSchema }),
    controller.removeAddress,
  );

  router.get(
    "/:id/contacts",
    requirePermission("resellers:read"),
    validate({ params: resellerIdParamSchema, query: contactListQuerySchema }),
    controller.listContacts,
  );
  router.post(
    "/:id/contacts",
    requirePermission("resellers:update"),
    validate({ params: resellerIdParamSchema, body: contactBodySchema }),
    controller.createContact,
  );

  router.get(
    "/:id/customers",
    requirePermission("resellers:read"),
    validate({ params: resellerIdParamSchema, query: contactListQuerySchema }),
    controller.listCustomers,
  );
  router.post(
    "/:id/customers/:customerId",
    requirePermission("resellers:update"),
    validate({ params: customerAssignParamSchema }),
    controller.assignCustomer,
  );
  router.delete(
    "/:id/customers/:customerId",
    requirePermission("resellers:update"),
    validate({ params: customerAssignParamSchema }),
    controller.unassignCustomer,
  );

  router.get("/:id", requirePermission("resellers:read"), validate({ params: resellerIdParamSchema }), controller.get);
  router.patch(
    "/:id",
    requirePermission("resellers:update"),
    validate({ params: resellerIdParamSchema, body: updateResellerSchema }),
    controller.update,
  );
  router.delete(
    "/:id",
    requirePermission("resellers:delete"),
    validate({ params: resellerIdParamSchema }),
    controller.remove,
  );
  router.post(
    "/:id/restore",
    requirePermission("resellers:restore"),
    validate({ params: resellerIdParamSchema }),
    controller.restore,
  );

  return router;
}

export function createResellerContactsRouter(controller: ResellersController): Router {
  const router = Router();
  router.use(authenticate);
  router.patch(
    "/:id",
    requirePermission("resellers:update"),
    validate({ params: contactIdParamSchema, body: updateContactSchema }),
    controller.updateContact,
  );
  router.delete(
    "/:id",
    requirePermission("resellers:update"),
    validate({ params: contactIdParamSchema }),
    controller.removeContact,
  );
  return router;
}
