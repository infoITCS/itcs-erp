import { Router } from "express";
import { listQuerySchema } from "../../common/pagination/list-query";
import { validate } from "../../common/validation/validate";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import type { OpportunitiesController } from "./controller";
import {
  changeStageSchema,
  convertOpportunitySchema,
  createOpportunitySchema,
  createProductInterestSchema,
  markLostSchema,
  markWonSchema,
  opportunityIdParamSchema,
  opportunityListQuerySchema,
  productInterestParamSchema,
  reopenOpportunitySchema,
  updateOpportunitySchema,
  updateProductInterestSchema,
} from "./validation";

export function createOpportunitiesRouter(controller: OpportunitiesController): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", requirePermission("opportunities:read"), validate({ query: opportunityListQuerySchema }), controller.list);
  router.get("/form-options", requirePermission("opportunities:read"), controller.formOptions);
  router.post("/", requirePermission("opportunities:create"), validate({ body: createOpportunitySchema }), controller.create);

  router.get(
    "/:id",
    requirePermission("opportunities:read"),
    validate({ params: opportunityIdParamSchema }),
    controller.get,
  );
  router.patch(
    "/:id",
    requirePermission("opportunities:update"),
    validate({ params: opportunityIdParamSchema, body: updateOpportunitySchema }),
    controller.update,
  );
  router.delete(
    "/:id",
    requirePermission("opportunities:delete"),
    validate({ params: opportunityIdParamSchema }),
    controller.remove,
  );
  router.post(
    "/:id/restore",
    requirePermission("opportunities:restore"),
    validate({ params: opportunityIdParamSchema }),
    controller.restore,
  );

  router.post(
    "/:id/stage",
    requirePermission("opportunities:update"),
    validate({ params: opportunityIdParamSchema, body: changeStageSchema }),
    controller.changeStage,
  );
  router.post(
    "/:id/won",
    requirePermission("opportunities:update"),
    validate({ params: opportunityIdParamSchema, body: markWonSchema }),
    controller.markWon,
  );
  router.post(
    "/:id/lost",
    requirePermission("opportunities:update"),
    validate({ params: opportunityIdParamSchema, body: markLostSchema }),
    controller.markLost,
  );
  router.post(
    "/:id/reopen",
    requirePermission("opportunities:update"),
    validate({ params: opportunityIdParamSchema, body: reopenOpportunitySchema }),
    controller.reopen,
  );
  router.post(
    "/:id/convert",
    requirePermission("opportunities:update"),
    validate({ params: opportunityIdParamSchema, body: convertOpportunitySchema }),
    controller.convert,
  );

  router.get(
    "/:id/products",
    requirePermission("opportunities:read"),
    validate({ params: opportunityIdParamSchema }),
    controller.listProductInterests,
  );
  router.post(
    "/:id/products",
    requirePermission("opportunities:update"),
    validate({ params: opportunityIdParamSchema, body: createProductInterestSchema }),
    controller.createProductInterest,
  );
  router.patch(
    "/:id/products/:interestId",
    requirePermission("opportunities:update"),
    validate({ params: productInterestParamSchema, body: updateProductInterestSchema }),
    controller.updateProductInterest,
  );
  router.delete(
    "/:id/products/:interestId",
    requirePermission("opportunities:update"),
    validate({ params: productInterestParamSchema }),
    controller.removeProductInterest,
  );

  router.get(
    "/:id/audit",
    requirePermission("opportunities:read"),
    validate({ params: opportunityIdParamSchema, query: listQuerySchema }),
    controller.listAudit,
  );

  return router;
}
