import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { PaymentsController } from "./controller";
import { PaymentsRepository } from "./repository";
import { createPaymentsRouter } from "./routes";
import { PaymentsService } from "./service";

export function createPaymentsModule(deps: ModuleDependencies): AppModule {
  const audit = new AuditLogsService(new AuditLogsRepository(deps.db));
  const repository = new PaymentsRepository(deps.db);
  const service = new PaymentsService(repository, audit);
  const controller = new PaymentsController(service);

  return {
    name: "payments",
    basePath: "/payments",
    router: createPaymentsRouter(controller),
  };
}
