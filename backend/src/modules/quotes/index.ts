import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { QuotesController } from "./controller";
import { QuotesRepository } from "./repository";
import { createQuotesRouter } from "./routes";
import { QuotesService } from "./service";

export function createQuotesModule(deps: ModuleDependencies): AppModule {
  const audit = new AuditLogsService(new AuditLogsRepository(deps.db));
  const repository = new QuotesRepository(deps.db);
  const service = new QuotesService(repository, audit);
  const controller = new QuotesController(service);

  return {
    name: "quotes",
    basePath: "/quotes",
    router: createQuotesRouter(controller),
  };
}
