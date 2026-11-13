import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { ProfileController } from "./controller";
import { ProfileRepository } from "./repository";
import { createProfileRouter } from "./routes";
import { ProfileService } from "./service";

export function createProfileModule(deps: ModuleDependencies): AppModule {
  const service = new ProfileService(
    new ProfileRepository(deps.db),
    new AuditLogsService(new AuditLogsRepository(deps.db)),
  );
  const controller = new ProfileController(service);

  return {
    name: "profile",
    basePath: "/profile",
    router: createProfileRouter(controller),
  };
}
