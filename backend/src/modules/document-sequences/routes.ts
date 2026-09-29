import { Router } from "express";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { DocumentSequencesController } from "./controller";
import { documentSequenceQuerySchema } from "./validation";

export function createDocumentSequencesRouter(controller: DocumentSequencesController): Router {
  const router = Router();
  router.get(
    "/",
    authenticate,
    requirePermission("document-sequences:read"),
    validate({ query: documentSequenceQuerySchema }),
    controller.list,
  );
  return router;
}
