import type { AppModule, ModuleDependencies } from "../module";
import { OpportunitiesController } from "./controller";
import { OpportunitiesRepository } from "./repository";
import { createOpportunitiesRouter } from "./routes";
import { OpportunitiesService } from "./service";

export function createOpportunitiesModule(deps: ModuleDependencies): AppModule {
  const repository = new OpportunitiesRepository(deps.db);
  const service = new OpportunitiesService(repository);
  const controller = new OpportunitiesController(service);

  return {
    name: "opportunities",
    basePath: "/opportunities",
    router: createOpportunitiesRouter(controller),
  };
}
