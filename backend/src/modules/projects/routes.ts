import { Router } from "express";
import { listQuerySchema } from "../../common/pagination/list-query";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { ProjectsController } from "./controller";
import {
  createProjectSchema,
  projectIdParamSchema,
  projectListQuerySchema,
  updateProjectSchema,
} from "./validation";

export function createProjectsRouter(controller: ProjectsController): Router {
  const router = Router();
  router.use(authenticate);

  router.get(
    "/",
    requirePermission("projects:read"),
    validate({ query: projectListQuerySchema }),
    controller.list,
  );
  router.get("/form-options", requirePermission("projects:read"), controller.formOptions);
  router.post("/", requirePermission("projects:create"), validate({ body: createProjectSchema }), controller.create);

  router.get(
    "/:id",
    requirePermission("projects:read"),
    validate({ params: projectIdParamSchema }),
    controller.get,
  );
  router.patch(
    "/:id",
    requirePermission("projects:update"),
    validate({ params: projectIdParamSchema, body: updateProjectSchema }),
    controller.update,
  );
  router.delete(
    "/:id",
    requirePermission("projects:delete"),
    validate({ params: projectIdParamSchema }),
    controller.remove,
  );
  router.get(
    "/:id/financials",
    requirePermission("projects:read"),
    validate({ params: projectIdParamSchema }),
    controller.financials,
  );
  router.get(
    "/:id/activity",
    requirePermission("projects:read"),
    validate({ params: projectIdParamSchema }),
    controller.activity,
  );
  router.get(
    "/:id/audit",
    requirePermission("projects:read"),
    validate({ params: projectIdParamSchema, query: listQuerySchema }),
    controller.listAudit,
  );

  return router;
}
