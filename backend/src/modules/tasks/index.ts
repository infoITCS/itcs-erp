import type { AppModule, ModuleDependencies } from "../module";
import { TasksController } from "./controller";
import { TasksRepository } from "./repository";
import { createTasksRouter } from "./routes";
import { TasksService } from "./service";

export function createTasksModule(deps: ModuleDependencies): AppModule {
  const repository = new TasksRepository(deps.db);
  const service = new TasksService(repository);
  const controller = new TasksController(service);

  return {
    name: "tasks",
    basePath: "/tasks",
    router: createTasksRouter(controller),
  };
}
