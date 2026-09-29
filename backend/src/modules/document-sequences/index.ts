import type { AppModule, ModuleDependencies } from "../module";
import { DocumentSequencesController } from "./controller";
import { DocumentSequencesRepository } from "./repository";
import { createDocumentSequencesRouter } from "./routes";
import { DocumentSequencesService } from "./service";

export function createDocumentSequencesModule(deps: ModuleDependencies): AppModule {
  const controller = new DocumentSequencesController(
    new DocumentSequencesService(new DocumentSequencesRepository(deps.db)),
  );
  return {
    name: "document-sequences",
    basePath: "/document-sequences",
    router: createDocumentSequencesRouter(controller),
  };
}
