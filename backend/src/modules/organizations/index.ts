import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { OrganizationsController } from "./controller";
import { OrganizationsRepository } from "./repository";
import { createOrganizationsRouter } from "./routes";
import { OrganizationsService } from "./service";

export function createOrganizationsModule(deps: ModuleDependencies): AppModule {
  const service = new OrganizationsService(
    new OrganizationsRepository(deps.db),
    new AuditLogsService(new AuditLogsRepository(deps.db)),
  );
  const controller = new OrganizationsController(service);
  return {
    name: "organizations",
    basePath: "/organizations",
    router: createOrganizationsRouter(controller),
  };
}
