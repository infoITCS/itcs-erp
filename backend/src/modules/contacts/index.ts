import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { ContactsController } from "./controller";
import { ContactsRepository } from "./repository";
import { createContactsRouter } from "./routes";
import { ContactsService } from "./service";

export function createContactsModule(deps: ModuleDependencies): AppModule {
  const audit = new AuditLogsService(new AuditLogsRepository(deps.db));
  const service = new ContactsService(new ContactsRepository(deps.db), audit);
  const controller = new ContactsController(service);

  return {
    name: "contacts",
    basePath: "/contacts",
    router: createContactsRouter(controller),
  };
}
