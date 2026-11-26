import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsController } from "./controller";
import { AuditEnrichmentRepository } from "./enrichment-repository";
import { AuditLogsRepository } from "./repository";
import { createAuditLogsRouter } from "./routes";
import { AuditLogsService } from "./service";

export function createAuditLogsModule(deps: ModuleDependencies): AppModule {
  const repository = new AuditLogsRepository(deps.db);
  const enricher = new AuditEnrichmentRepository(deps.db);
  const controller = new AuditLogsController(new AuditLogsService(repository, enricher, repository));
  return {
    name: "audit-logs",
    basePath: "/audit-logs",
    router: createAuditLogsRouter(controller),
  };
}
