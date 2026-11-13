import type { AppModule, ModuleDependencies } from "../module";
import { AnalyticsController } from "./controller";
import { AnalyticsRepository } from "./repository";
import { createAnalyticsRouter } from "./routes";
import { AnalyticsService } from "./service";

export function createAnalyticsModule(deps: ModuleDependencies): AppModule {
  const repository = new AnalyticsRepository(deps.db, deps.readDb);
  const service = new AnalyticsService(repository);
  const controller = new AnalyticsController(service);

  return {
    name: "analytics",
    basePath: "/analytics",
    router: createAnalyticsRouter(controller),
  };
}
