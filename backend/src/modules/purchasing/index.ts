import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { PurchasingController } from "./controller";
import { PurchasingRepository } from "./repository";
import { createPurchasingRouter } from "./routes";
import { PurchasingService } from "./service";

export function createPurchasingModule(deps: ModuleDependencies): AppModule {
  const audit = new AuditLogsService(new AuditLogsRepository(deps.db));
  const repository = new PurchasingRepository(deps.db);
  const service = new PurchasingService(repository, audit);
  const controller = new PurchasingController(service);

  return {
    name: "purchasing",
    basePath: "/purchasing",
    router: createPurchasingRouter(controller),
  };
}
