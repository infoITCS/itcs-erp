import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { ProductsController } from "./controller";
import { ProductsRepository } from "./repository";
import {
  createCategoriesRouter,
  createPricesRouter,
  createProductsRouter,
  createTaxCodesRouter,
  createUnitsOfMeasureRouter,
} from "./routes";
import { ProductsService } from "./service";

export function createProductsModules(deps: ModuleDependencies): AppModule[] {
  const audit = new AuditLogsService(new AuditLogsRepository(deps.db));
  const service = new ProductsService(new ProductsRepository(deps.db), audit);
  const controller = new ProductsController(service);

  return [
    { name: "products", basePath: "/products", router: createProductsRouter(controller) },
    { name: "product-prices", basePath: "/prices", router: createPricesRouter(controller) },
    { name: "product-categories", basePath: "/categories", router: createCategoriesRouter(controller) },
    { name: "units-of-measure", basePath: "/units-of-measure", router: createUnitsOfMeasureRouter(controller) },
    { name: "tax-codes", basePath: "/tax-codes", router: createTaxCodesRouter(controller) },
  ];
}
