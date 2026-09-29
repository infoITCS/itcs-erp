import type { AppModule, ModuleDependencies } from "../module";
import { ContactsController } from "./controller";
import { ContactsRepository } from "./repository";
import { createContactsRouter } from "./routes";
import { ContactsService } from "./service";

export function createContactsModule(deps: ModuleDependencies): AppModule {
  const repository = new ContactsRepository(deps.db);
  const service = new ContactsService(repository);
  const controller = new ContactsController(service);

  return {
    name: "contacts",
    basePath: "/contacts",
    router: createContactsRouter(controller),
  };
}
