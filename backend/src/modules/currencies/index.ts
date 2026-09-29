import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { CurrenciesController } from "./controller";
import { CurrenciesRepository } from "./repository";
import { createCurrenciesRouter } from "./routes";
import { CurrenciesService } from "./service";

export function createCurrenciesModule(deps: ModuleDependencies): AppModule {
  const service = new CurrenciesService(
    new CurrenciesRepository(deps.db),
    new AuditLogsService(new AuditLogsRepository(deps.db)),
  );
  return {
    name: "currencies",
    basePath: "/currencies",
    router: createCurrenciesRouter(new CurrenciesController(service)),
  };
}
