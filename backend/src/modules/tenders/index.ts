import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { TendersController } from "./controller";
import { TendersRepository } from "./repository";
import { createTendersRouter } from "./routes";
import { TendersService } from "./service";

export function createTendersModule(deps: ModuleDependencies): AppModule {
  const audit = new AuditLogsService(new AuditLogsRepository(deps.db));
  const repository = new TendersRepository(deps.db);
  const service = new TendersService(repository, audit);
  const controller = new TendersController(service);

  return {
    name: "tenders",
    basePath: "/tenders",
    router: createTendersRouter(controller),
  };
}
