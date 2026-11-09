import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { CustomersRepository } from "../customers/repository";
import { CustomersService } from "../customers/service";
import { OpportunitiesRepository } from "../opportunities/repository";
import { LeadsController } from "./controller";
import { LeadsRepository } from "./repository";
import { createLeadsRouter } from "./routes";
import { LeadsService } from "./service";

export function createLeadsModule(deps: ModuleDependencies): AppModule {
  const audit = new AuditLogsService(new AuditLogsRepository(deps.db));
  const customers = new CustomersService(new CustomersRepository(deps.db), audit);
  const opportunitiesRepository = new OpportunitiesRepository(deps.db);
  const repository = new LeadsRepository(deps.db);
  const service = new LeadsService(repository, opportunitiesRepository, customers, audit);
  const controller = new LeadsController(service);

  return {
    name: "leads",
    basePath: "/leads",
    router: createLeadsRouter(controller),
  };
}
