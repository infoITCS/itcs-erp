import type { AppModule, ModuleDependencies } from "../module";
import { NotificationsController } from "./controller";
import { NotificationsRepository } from "./repository";
import { createNotificationsRouter } from "./routes";
import { NotificationsService } from "./service";

export function createNotificationsModule(deps: ModuleDependencies): AppModule {
  const repository = new NotificationsRepository(deps.db);
  const service = new NotificationsService(repository);
  const controller = new NotificationsController(service);

  return {
    name: "notifications",
    basePath: "/notifications",
    router: createNotificationsRouter(controller),
  };
}
