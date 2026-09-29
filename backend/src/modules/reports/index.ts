import type { AppModule, ModuleDependencies } from "../module";
import { ReportsController } from "./controller";
import { ReportsRepository } from "./repository";
import { createReportsRouter } from "./routes";
import { ReportsService } from "./service";

export function createReportsModule(deps: ModuleDependencies): AppModule {
  const repository = new ReportsRepository(deps.db, deps.readDb);
  const service = new ReportsService(repository);
  const controller = new ReportsController(service);

  return {
    name: "reports",
    basePath: "/reports",
    router: createReportsRouter(controller),
  };
}
