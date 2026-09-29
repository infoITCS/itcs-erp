import type { AppModule, ModuleDependencies } from "../module";
import { OrganizationsController } from "./controller";
import { OrganizationsRepository } from "./repository";
import { createOrganizationsRouter } from "./routes";
import { OrganizationsService } from "./service";

export function createOrganizationsModule(deps: ModuleDependencies): AppModule {
  const controller = new OrganizationsController(new OrganizationsService(new OrganizationsRepository(deps.db)));
  return {
    name: "organizations",
    basePath: "/organizations",
    router: createOrganizationsRouter(controller),
  };
}
