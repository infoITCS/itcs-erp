import type { AppModule, ModuleDependencies } from "../module";
import { SalesOrdersController } from "./controller";
import { SalesOrdersRepository } from "./repository";
import { createSalesOrdersRouter } from "./routes";
import { SalesOrdersService } from "./service";

export function createSalesOrdersModule(deps: ModuleDependencies): AppModule {
  const repository = new SalesOrdersRepository(deps.db);
  const service = new SalesOrdersService(repository);
  const controller = new SalesOrdersController(service);

  return {
    name: "sales-orders",
    basePath: "/sales-orders",
    router: createSalesOrdersRouter(controller),
  };
}
