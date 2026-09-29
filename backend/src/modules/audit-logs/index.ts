import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsController } from "./controller";
import { AuditLogsRepository } from "./repository";
import { createAuditLogsRouter } from "./routes";
import { AuditLogsService } from "./service";

export function createAuditLogsModule(deps: ModuleDependencies): AppModule {
  const controller = new AuditLogsController(new AuditLogsService(new AuditLogsRepository(deps.db)));
  return {
    name: "audit-logs",
    basePath: "/audit-logs",
    router: createAuditLogsRouter(controller),
  };
}
