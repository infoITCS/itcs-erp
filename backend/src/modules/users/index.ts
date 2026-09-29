import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { UsersController } from "./controller";
import { UsersRepository } from "./repository";
import { createUsersRouter } from "./routes";
import { UsersService } from "./service";

export function createUsersModule(deps: ModuleDependencies): AppModule {
  const service = new UsersService(
    new UsersRepository(deps.db),
    new AuditLogsService(new AuditLogsRepository(deps.db)),
  );
  const controller = new UsersController(service);
  return {
    name: "users",
    basePath: "/users",
    router: createUsersRouter(controller),
  };
}
