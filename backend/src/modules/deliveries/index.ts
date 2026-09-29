import type { AppModule, ModuleDependencies } from "../module";
import { DeliveriesController } from "./controller";
import { DeliveriesRepository } from "./repository";
import { createDeliveriesRouter } from "./routes";
import { DeliveriesService } from "./service";

export function createDeliveriesModule(deps: ModuleDependencies): AppModule {
  const repository = new DeliveriesRepository(deps.db);
  const service = new DeliveriesService(repository);
  const controller = new DeliveriesController(service);

  return {
    name: "deliveries",
    basePath: "/deliveries",
    router: createDeliveriesRouter(controller),
  };
}
