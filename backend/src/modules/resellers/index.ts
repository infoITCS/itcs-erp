import type { AppModule, ModuleDependencies } from "../module";
import { AuditLogsRepository } from "../audit-logs/repository";
import { AuditLogsService } from "../audit-logs/service";
import { ResellersController } from "./controller";
import { ResellersRepository } from "./repository";
import { createResellerContactsRouter, createResellersRouter } from "./routes";
import { ResellersService } from "./service";

export function createResellersModules(deps: ModuleDependencies): AppModule[] {
  const audit = new AuditLogsService(new AuditLogsRepository(deps.db));
  const service = new ResellersService(new ResellersRepository(deps.db), audit);
  const controller = new ResellersController(service);

  return [
    { name: "resellers", basePath: "/resellers", router: createResellersRouter(controller) },
    {
      name: "reseller-contacts",
      basePath: "/reseller-contacts",
      router: createResellerContactsRouter(controller),
    },
  ];
}
