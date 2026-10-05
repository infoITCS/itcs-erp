import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { ContactsRepository } from "../contacts/repository";
import { ContactsService } from "../contacts/service";
import { CustomersController } from "./controller";
import { CustomersRepository } from "./repository";
import { createCustomersRouter } from "./routes";
import { CustomersService } from "./service";

export function createCustomersModule(deps: ModuleDependencies): AppModule {
  const audit = new AuditLogsService(new AuditLogsRepository(deps.db));
  const customers = new CustomersService(new CustomersRepository(deps.db), audit);
  const contacts = new ContactsService(new ContactsRepository(deps.db), audit);
  const controller = new CustomersController(customers, contacts);

  return {
    name: "customers",
    basePath: "/customers",
    router: createCustomersRouter(controller),
  };
}
