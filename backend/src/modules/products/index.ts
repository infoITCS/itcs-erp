import type { AppModule, ModuleDependencies } from "../module";
import { ProductsController } from "./controller";
import { ProductsRepository } from "./repository";
import { createProductsRouter } from "./routes";
import { ProductsService } from "./service";

export function createProductsModule(deps: ModuleDependencies): AppModule {
  const repository = new ProductsRepository(deps.db);
  const service = new ProductsService(repository);
  const controller = new ProductsController(service);

  return {
    name: "products",
    basePath: "/products",
    router: createProductsRouter(controller),
  };
}
