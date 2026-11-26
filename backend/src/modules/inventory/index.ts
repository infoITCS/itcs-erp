import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsService } from "../audit-logs/service";
import { AuditLogsRepository } from "../audit-logs/repository";
import { InventoryController } from "./controller";
import { InventoryRepository } from "./repository";
import { createInventoryRouter } from "./routes";
import { InventoryService } from "./service";

export function createInventoryModule(deps: ModuleDependencies): AppModule {
  const audit = new AuditLogsService(new AuditLogsRepository(deps.db));
  const repository = new InventoryRepository(deps.db);
  const service = new InventoryService(repository, audit);
  const controller = new InventoryController(service);

  return {
    name: "inventory",
    basePath: "/inventory",
    router: createInventoryRouter(controller),
  };
}
