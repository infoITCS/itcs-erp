import type { AppModule, ModuleDependencies } from "../module";
import { ExpensesController } from "./controller";
import { ExpensesRepository } from "./repository";
import { createExpensesRouter } from "./routes";
import { ExpensesService } from "./service";

export function createExpensesModule(deps: ModuleDependencies): AppModule {
  const repository = new ExpensesRepository(deps.db);
  const service = new ExpensesService(repository);
  const controller = new ExpensesController(service);

  return {
    name: "expenses",
    basePath: "/expenses",
    router: createExpensesRouter(controller),
  };
}
