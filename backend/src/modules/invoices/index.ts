import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { InvoicesController } from "./controller";
import { InvoicesRepository } from "./repository";
import { createInvoicesRouter } from "./routes";
import { InvoicesService } from "./service";

export function createInvoicesModule(deps: ModuleDependencies): AppModule {
  const audit = new AuditLogsService(new AuditLogsRepository(deps.db));
  const repository = new InvoicesRepository(deps.db);
  const service = new InvoicesService(repository, audit);
  const controller = new InvoicesController(service);

  return {
    name: "invoices",
    basePath: "/invoices",
    router: createInvoicesRouter(controller),
  };
}
