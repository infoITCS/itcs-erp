import type { AppModule, ModuleDependencies } from "../module";
import { CustomersController } from "./controller";
import { CustomersRepository } from "./repository";
import { createCustomersRouter } from "./routes";
import { CustomersService } from "./service";

export function createCustomersModule(deps: ModuleDependencies): AppModule {
  const repository = new CustomersRepository(deps.db);
  const service = new CustomersService(repository);
  const controller = new CustomersController(service);

  return {
    name: "customers",
    basePath: "/customers",
    router: createCustomersRouter(controller),
  };
}
