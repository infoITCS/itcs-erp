import type { AppModule, ModuleDependencies } from "../module";
import { VendorsController } from "./controller";
import { VendorsRepository } from "./repository";
import { createVendorsRouter } from "./routes";
import { VendorsService } from "./service";

export function createVendorsModule(deps: ModuleDependencies): AppModule {
  const repository = new VendorsRepository(deps.db);
  const service = new VendorsService(repository);
  const controller = new VendorsController(service);

  return {
    name: "vendors",
    basePath: "/vendors",
    router: createVendorsRouter(controller),
  };
}
