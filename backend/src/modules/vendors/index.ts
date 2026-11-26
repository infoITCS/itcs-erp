import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { VendorsController } from "./controller";
import { VendorsRepository } from "./repository";
import { createVendorsRouter } from "./routes";
import { VendorsService } from "./service";

export function createVendorsModule(deps: ModuleDependencies): AppModule {
  const audit = new AuditLogsService(new AuditLogsRepository(deps.db));
  const repository = new VendorsRepository(deps.db);
  const service = new VendorsService(repository, audit);
  const controller = new VendorsController(service);

  return {
    name: "vendors",
    basePath: "/vendors",
    router: createVendorsRouter(controller),
  };
}
