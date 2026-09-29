import type { AppModule, ModuleDependencies } from "../module";
import { ProjectsController } from "./controller";
import { ProjectsRepository } from "./repository";
import { createProjectsRouter } from "./routes";
import { ProjectsService } from "./service";

export function createProjectsModule(deps: ModuleDependencies): AppModule {
  const repository = new ProjectsRepository(deps.db);
  const service = new ProjectsService(repository);
  const controller = new ProjectsController(service);

  return {
    name: "projects",
    basePath: "/projects",
    router: createProjectsRouter(controller),
  };
}
