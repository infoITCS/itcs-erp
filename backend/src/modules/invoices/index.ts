import type { AppModule, ModuleDependencies } from "../module";
import { InvoicesController } from "./controller";
import { InvoicesRepository } from "./repository";
import { createInvoicesRouter } from "./routes";
import { InvoicesService } from "./service";

export function createInvoicesModule(deps: ModuleDependencies): AppModule {
  const repository = new InvoicesRepository(deps.db);
  const service = new InvoicesService(repository);
  const controller = new InvoicesController(service);

  return {
    name: "invoices",
    basePath: "/invoices",
    router: createInvoicesRouter(controller),
  };
}
