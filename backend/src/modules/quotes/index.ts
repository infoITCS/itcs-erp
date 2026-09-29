import type { AppModule, ModuleDependencies } from "../module";
import { QuotesController } from "./controller";
import { QuotesRepository } from "./repository";
import { createQuotesRouter } from "./routes";
import { QuotesService } from "./service";

export function createQuotesModule(deps: ModuleDependencies): AppModule {
  const repository = new QuotesRepository(deps.db);
  const service = new QuotesService(repository);
  const controller = new QuotesController(service);

  return {
    name: "quotes",
    basePath: "/quotes",
    router: createQuotesRouter(controller),
  };
}
