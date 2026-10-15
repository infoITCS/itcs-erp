import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { CustomersRepository } from "../customers/repository";
import { CustomersService } from "../customers/service";
import { OpportunitiesController } from "./controller";
import { OpportunitiesRepository } from "./repository";
import { createOpportunitiesRouter } from "./routes";
import { OpportunitiesService } from "./service";

export function createOpportunitiesModule(deps: ModuleDependencies): AppModule {
  const audit = new AuditLogsService(new AuditLogsRepository(deps.db));
  const customers = new CustomersService(new CustomersRepository(deps.db), audit);
  const repository = new OpportunitiesRepository(deps.db);
  const service = new OpportunitiesService(repository, customers, audit);
  const controller = new OpportunitiesController(service);

  return {
    name: "opportunities",
    basePath: "/opportunities",
    router: createOpportunitiesRouter(controller),
  };
}
