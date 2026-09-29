import type { AppModule, ModuleDependencies } from "../module";
import { RenewalsController } from "./controller";
import { RenewalsRepository } from "./repository";
import { createRenewalsRouter } from "./routes";
import { RenewalsService } from "./service";

export function createRenewalsModule(deps: ModuleDependencies): AppModule {
  const repository = new RenewalsRepository(deps.db);
  const service = new RenewalsService(repository);
  const controller = new RenewalsController(service);

  return {
    name: "renewals",
    basePath: "/renewals",
    router: createRenewalsRouter(controller),
  };
}
