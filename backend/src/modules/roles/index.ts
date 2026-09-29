import type { AppModule, ModuleDependencies } from "../module";
import { RolesController } from "./controller";
import { RolesRepository } from "./repository";
import { createRolesRouter } from "./routes";
import { RolesService } from "./service";

export function createRolesModule(deps: ModuleDependencies): AppModule {
  const controller = new RolesController(new RolesService(new RolesRepository(deps.db)));
  return { name: "roles", basePath: "/roles", router: createRolesRouter(controller) };
}
