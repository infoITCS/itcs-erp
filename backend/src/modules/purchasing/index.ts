import type { AppModule, ModuleDependencies } from "../module";
import { PurchasingController } from "./controller";
import { PurchasingRepository } from "./repository";
import { createPurchasingRouter } from "./routes";
import { PurchasingService } from "./service";

export function createPurchasingModule(deps: ModuleDependencies): AppModule {
  const repository = new PurchasingRepository(deps.db);
  const service = new PurchasingService(repository);
  const controller = new PurchasingController(service);

  return {
    name: "purchasing",
    basePath: "/purchasing",
    router: createPurchasingRouter(controller),
  };
}
