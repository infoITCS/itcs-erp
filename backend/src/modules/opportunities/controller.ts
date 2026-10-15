import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import type { ListQuery } from "../../common/pagination/list-query";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { OpportunitiesService } from "./service";
import type {
  ChangeStageInput,
  ConvertOpportunityInput,
  CreateOpportunityInput,
  CreateProductInterestInput,
  MarkLostInput,
  MarkWonInput,
  OpportunityListQuery,
  ReopenOpportunityInput,
  UpdateOpportunityInput,
  UpdateProductInterestInput,
} from "./validation";

function meta(req: Request): RequestMeta {
  return { ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}

function organizationId(req: Request): string {
  if (!req.auth?.organizationId) {
    throw new UnauthorizedError();
  }
  return req.auth.organizationId;
}

function actorId(req: Request): string {
  if (!req.auth?.userId) {
    throw new UnauthorizedError();
  }
  return req.auth.userId;
}

export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as OpportunityListQuery;
    const page = await this.opportunitiesService.list(organizationId(req), query, req.auth?.permissions ?? []);
    sendSuccess(res, { message: "Opportunities", data: page });
  });

  formOptions = asyncHandler(async (req: Request, res: Response) => {
    const options = await this.opportunitiesService.formOptions(organizationId(req));
    sendSuccess(res, { message: "Opportunity form options", data: options });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as CreateOpportunityInput;
    const opportunity = await this.opportunitiesService.create(organizationId(req), actorId(req), body, meta(req));
    sendSuccess(res, { message: "Opportunity created", data: opportunity }, 201);
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const opportunity = await this.opportunitiesService.get(organizationId(req), params.id);
    sendSuccess(res, { message: "Opportunity", data: opportunity });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdateOpportunityInput;
    const opportunity = await this.opportunitiesService.update(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Opportunity updated", data: opportunity });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const result = await this.opportunitiesService.remove(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Opportunity deleted", data: result });
  });

  restore = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const opportunity = await this.opportunitiesService.restore(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Opportunity restored", data: opportunity });
  });

  changeStage = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as ChangeStageInput;
    const opportunity = await this.opportunitiesService.changeStage(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Stage updated", data: opportunity });
  });

  markWon = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as MarkWonInput;
    const opportunity = await this.opportunitiesService.markWon(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Opportunity marked won", data: opportunity });
  });

  markLost = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as MarkLostInput;
    const opportunity = await this.opportunitiesService.markLost(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Opportunity marked lost", data: opportunity });
  });

  reopen = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as ReopenOpportunityInput;
    const opportunity = await this.opportunitiesService.reopen(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Opportunity reopened", data: opportunity });
  });

  convert = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as ConvertOpportunityInput;
    const opportunity = await this.opportunitiesService.convert(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Opportunity converted", data: opportunity });
  });

  listProductInterests = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const interests = await this.opportunitiesService.listProductInterests(organizationId(req), params.id);
    sendSuccess(res, { message: "Product interests", data: interests });
  });

  createProductInterest = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as CreateProductInterestInput;
    const interest = await this.opportunitiesService.createProductInterest(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Product interest created", data: interest }, 201);
  });

  updateProductInterest = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string; interestId: string };
    const body = req.validated?.body as UpdateProductInterestInput;
    const interest = await this.opportunitiesService.updateProductInterest(
      organizationId(req),
      actorId(req),
      params.id,
      params.interestId,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Product interest updated", data: interest });
  });

  removeProductInterest = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string; interestId: string };
    const result = await this.opportunitiesService.removeProductInterest(
      organizationId(req),
      actorId(req),
      params.id,
      params.interestId,
      meta(req),
    );
    sendSuccess(res, { message: "Product interest deleted", data: result });
  });

  listAudit = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const query = req.validated?.query as ListQuery;
    const page = await this.opportunitiesService.listAudit(organizationId(req), params.id, query.limit, query.cursor);
    sendSuccess(res, { message: "Opportunity audit log", data: page });
  });
}
