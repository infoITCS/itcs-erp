import type { AppModule, ModuleDependencies } from "../module";
import { ResellersController } from "./controller";
import { ResellersRepository } from "./repository";
import { createResellersRouter } from "./routes";
import { ResellersService } from "./service";

export function createResellersModule(deps: ModuleDependencies): AppModule {
  const repository = new ResellersRepository(deps.db);
  const service = new ResellersService(repository);
  const controller = new ResellersController(service);

  return {
    name: "resellers",
    basePath: "/resellers",
    router: createResellersRouter(controller),
  };
}
