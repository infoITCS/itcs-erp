import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import { contactBodySchema, contactListQuerySchema } from "../contacts/validation";
import type { CustomersController } from "./controller";
import {
  addressIdParamSchema,
  addressInputSchema,
  createAccountingCategorySchema,
  createCustomerSchema,
  customerContactParamSchema,
  customerIdParamSchema,
  customerListQuerySchema,
  createPaymentTermSchema,
  updateCustomerSchema,
} from "./validation";

export function createCustomersRouter(controller: CustomersController): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", requirePermission("customers:read"), validate({ query: customerListQuerySchema }), controller.list);
  router.get("/form-options", requirePermission("customers:read"), controller.formOptions);
  router.post("/payment-terms", requirePermission("customers:create"), validate({ body: createPaymentTermSchema }), controller.createPaymentTerm);
  router.post("/accounting-categories", requirePermission("customers:create"), validate({ body: createAccountingCategorySchema }), controller.createAccountingCategory);
  router.post("/", requirePermission("customers:create"), validate({ body: createCustomerSchema }), controller.create);
  router.get(
    "/:id/addresses",
    requirePermission("customers:read"),
    validate({ params: customerIdParamSchema }),
    controller.listAddresses,
  );
  router.post(
    "/:id/addresses",
    requirePermission("customers:update"),
    validate({ params: customerIdParamSchema, body: addressInputSchema }),
    controller.createAddress,
  );
  router.patch(
    "/:id/addresses/:addressId",
    requirePermission("customers:update"),
    validate({ params: addressIdParamSchema, body: addressInputSchema }),
    controller.updateAddress,
  );
  router.delete(
    "/:id/addresses/:addressId",
    requirePermission("customers:update"),
    validate({ params: addressIdParamSchema }),
    controller.removeAddress,
  );
  router.get(
    "/:customerId/contacts",
    requirePermission("customers:read"),
    validate({ params: customerContactParamSchema, query: contactListQuerySchema }),
    controller.listContacts,
  );
  router.post(
    "/:customerId/contacts",
    requirePermission("contacts:create"),
    validate({ params: customerContactParamSchema, body: contactBodySchema }),
    controller.createContact,
  );
  router.get("/:id", requirePermission("customers:read"), validate({ params: customerIdParamSchema }), controller.get);
  router.patch(
    "/:id",
    requirePermission("customers:update"),
    validate({ params: customerIdParamSchema, body: updateCustomerSchema }),
    controller.update,
  );
  router.delete(
    "/:id",
    requirePermission("customers:delete"),
    validate({ params: customerIdParamSchema }),
    controller.remove,
  );
  router.delete(
    "/:id/permanent",
    requirePermission("customers:delete"),
    validate({ params: customerIdParamSchema }),
    controller.permanentlyRemove,
  );
  router.post(
    "/:id/restore",
    requirePermission("customers:restore"),
    validate({ params: customerIdParamSchema }),
    controller.restore,
  );

  return router;
}
