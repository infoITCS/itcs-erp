import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { ProductsController } from "./controller";
import {
  categoryIdParamSchema,
  createCategorySchema,
  createProductSchema,
  priceIdParamSchema,
  productIdParamSchema,
  productListQuerySchema,
  productPriceInputSchema,
  updateCategorySchema,
  updateProductSchema,
} from "./validation";

export function createProductsRouter(controller: ProductsController): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", requirePermission("products:read"), validate({ query: productListQuerySchema }), controller.list);
  router.post("/", requirePermission("products:create"), validate({ body: createProductSchema }), controller.create);
  router.get(
    "/:id/prices",
    requirePermission("products:read"),
    validate({ params: productIdParamSchema }),
    controller.listPrices,
  );
  router.post(
    "/:id/prices",
    requirePermission("products:update"),
    validate({ params: productIdParamSchema, body: productPriceInputSchema }),
    controller.createPrice,
  );
  router.get("/:id", requirePermission("products:read"), validate({ params: productIdParamSchema }), controller.get);
  router.patch(
    "/:id",
    requirePermission("products:update"),
    validate({ params: productIdParamSchema, body: updateProductSchema }),
    controller.update,
  );
  router.delete(
    "/:id",
    requirePermission("products:delete"),
    validate({ params: productIdParamSchema }),
    controller.remove,
  );
  router.post(
    "/:id/restore",
    requirePermission("products:restore"),
    validate({ params: productIdParamSchema }),
    controller.restore,
  );

  return router;
}

export function createPricesRouter(controller: ProductsController): Router {
  const router = Router();
  router.use(authenticate);
  router.patch(
    "/:id",
    requirePermission("products:update"),
    validate({ params: priceIdParamSchema, body: productPriceInputSchema }),
    controller.updatePrice,
  );
  router.delete(
    "/:id",
    requirePermission("products:update"),
    validate({ params: priceIdParamSchema }),
    controller.removePrice,
  );
  return router;
}

export function createCategoriesRouter(controller: ProductsController): Router {
  const router = Router();
  router.use(authenticate);
  router.get("/", requirePermission("products:read"), controller.listCategories);
  router.post(
    "/",
    requirePermission("products:create"),
    validate({ body: createCategorySchema }),
    controller.createCategory,
  );
  router.patch(
    "/:id",
    requirePermission("products:update"),
    validate({ params: categoryIdParamSchema, body: updateCategorySchema }),
    controller.updateCategory,
  );
  router.delete(
    "/:id",
    requirePermission("products:delete"),
    validate({ params: categoryIdParamSchema }),
    controller.removeCategory,
  );
  return router;
}

export function createUnitsOfMeasureRouter(controller: ProductsController): Router {
  const router = Router();
  router.use(authenticate);
  router.get("/", requirePermission("products:read"), controller.listUnits);
  return router;
}

export function createTaxCodesRouter(controller: ProductsController): Router {
  const router = Router();
  router.use(authenticate);
  router.get("/", requirePermission("products:read"), controller.listTaxCodes);
  return router;
}
