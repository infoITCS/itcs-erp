import type { AppModule, ModuleDependencies } from "../module";
import { AccountingController } from "./controller";
import { AccountingRepository } from "./repository";
import { createAccountingRouter } from "./routes";
import { AccountingService } from "./service";

export function createAccountingModule(deps: ModuleDependencies): AppModule {
  const repository = new AccountingRepository(deps.db);
  const service = new AccountingService(repository);
  const controller = new AccountingController(service);

  return {
    name: "accounting",
    basePath: "/accounting",
    router: createAccountingRouter(controller),
  };
}
