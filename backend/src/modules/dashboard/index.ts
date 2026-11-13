import type { AppModule, ModuleDependencies } from "../module";
import { DashboardController } from "./controller";
import { DashboardRepository } from "./repository";
import { createDashboardRouter } from "./routes";
import { DashboardService } from "./service";

export function createDashboardModule(deps: ModuleDependencies): AppModule {
  const repository = new DashboardRepository(deps.db);
  const service = new DashboardService(repository);
  const controller = new DashboardController(service);

  return {
    name: "dashboard",
    basePath: "/dashboard",
    router: createDashboardRouter(controller),
  };
}
