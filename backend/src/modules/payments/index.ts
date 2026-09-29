import type { AppModule, ModuleDependencies } from "../module";
import { PaymentsController } from "./controller";
import { PaymentsRepository } from "./repository";
import { createPaymentsRouter } from "./routes";
import { PaymentsService } from "./service";

export function createPaymentsModule(deps: ModuleDependencies): AppModule {
  const repository = new PaymentsRepository(deps.db);
  const service = new PaymentsService(repository);
  const controller = new PaymentsController(service);

  return {
    name: "payments",
    basePath: "/payments",
    router: createPaymentsRouter(controller),
  };
}
