import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { ProjectsController } from "./controller";
import { ProjectsRepository } from "./repository";
import { createProjectsRouter } from "./routes";
import { ProjectsService } from "./service";

export function createProjectsModule(deps: ModuleDependencies): AppModule {
  const audit = new AuditLogsService(new AuditLogsRepository(deps.db));
  const repository = new ProjectsRepository(deps.db);
  const service = new ProjectsService(repository, audit);
  const controller = new ProjectsController(service);

  return {
    name: "projects",
    basePath: "/projects",
    router: createProjectsRouter(controller),
  };
}
