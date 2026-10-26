import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { AuthController } from "./controller";
import { MicrosoftAuthService } from "./microsoft";
import { AuthRepository } from "./repository";
import { createAuthRouter } from "./routes";
import { AuthService } from "./service";

export function createAuthModule(deps: ModuleDependencies): AppModule {
  const repository = new AuthRepository(deps.db);
  const audit = new AuditLogsService(new AuditLogsRepository(deps.db));
  const service = new AuthService(repository, audit);
  const microsoft = new MicrosoftAuthService(repository, service, audit);
  const controller = new AuthController(service, microsoft);

  return {
    name: "auth",
    basePath: "/auth",
    router: createAuthRouter(controller),
  };
}
