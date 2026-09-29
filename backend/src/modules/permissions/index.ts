import type { AppModule, ModuleDependencies } from "../module";
import { PermissionsController } from "./controller";
import { PermissionsRepository } from "./repository";
import { createPermissionsRouter } from "./routes";
import { PermissionsService } from "./service";

export function createPermissionsModule(deps: ModuleDependencies): AppModule {
  const controller = new PermissionsController(new PermissionsService(new PermissionsRepository(deps.db)));
  return {
    name: "permissions",
    basePath: "/permissions",
    router: createPermissionsRouter(controller),
  };
}
