import type { AppModule, ModuleDependencies } from "../module";
import { InventoryController } from "./controller";
import { InventoryRepository } from "./repository";
import { createInventoryRouter } from "./routes";
import { InventoryService } from "./service";

export function createInventoryModule(deps: ModuleDependencies): AppModule {
  const repository = new InventoryRepository(deps.db);
  const service = new InventoryService(repository);
  const controller = new InventoryController(service);

  return {
    name: "inventory",
    basePath: "/inventory",
    router: createInventoryRouter(controller),
  };
}
