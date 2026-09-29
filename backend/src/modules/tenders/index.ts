import type { AppModule, ModuleDependencies } from "../module";
import { TendersController } from "./controller";
import { TendersRepository } from "./repository";
import { createTendersRouter } from "./routes";
import { TendersService } from "./service";

export function createTendersModule(deps: ModuleDependencies): AppModule {
  const repository = new TendersRepository(deps.db);
  const service = new TendersService(repository);
  const controller = new TendersController(service);

  return {
    name: "tenders",
    basePath: "/tenders",
    router: createTendersRouter(controller),
  };
}
