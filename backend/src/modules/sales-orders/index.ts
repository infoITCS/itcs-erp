import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { SalesOrdersController } from "./controller";
import { SalesOrdersRepository } from "./repository";
import { createSalesOrdersRouter } from "./routes";
import { SalesOrdersService } from "./service";

export function createSalesOrdersModule(deps: ModuleDependencies): AppModule {
  const audit = new AuditLogsService(new AuditLogsRepository(deps.db));
  const repository = new SalesOrdersRepository(deps.db);
  const service = new SalesOrdersService(repository, audit);
  const controller = new SalesOrdersController(service);

  return {
    name: "sales-orders",
    basePath: "/sales-orders",
    router: createSalesOrdersRouter(controller),
  };
}
