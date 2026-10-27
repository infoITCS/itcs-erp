import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { RolesController } from "./controller";
import { RolesRepository } from "./repository";
import { createRolesRouter } from "./routes";
import { RolesService } from "./service";

export function createRolesModule(deps: ModuleDependencies): AppModule {
  const service = new RolesService(
    new RolesRepository(deps.db),
    new AuditLogsService(new AuditLogsRepository(deps.db)),
  );
  const controller = new RolesController(service);
  return { name: "roles", basePath: "/roles", router: createRolesRouter(controller) };
}
