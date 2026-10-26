import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import type { ListQuery } from "../../common/pagination/list-query";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { TendersService } from "./service";
import type { CreateTenderInput, TenderListQuery, UpdateTenderInput } from "./validation";

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

export class TendersController {
  constructor(private readonly tendersService: TendersService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as TenderListQuery;
    const page = await this.tendersService.list(organizationId(req), query, req.auth?.permissions ?? []);
    sendSuccess(res, { message: "Tenders", data: page });
  });

  formOptions = asyncHandler(async (req: Request, res: Response) => {
    const options = await this.tendersService.formOptions(organizationId(req));
    sendSuccess(res, { message: "Tender form options", data: options });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as CreateTenderInput;
    const tender = await this.tendersService.create(organizationId(req), actorId(req), body, meta(req));
    sendSuccess(res, { message: "Tender created", data: tender }, 201);
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const tender = await this.tendersService.get(organizationId(req), params.id);
    sendSuccess(res, { message: "Tender", data: tender });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdateTenderInput;
    const tender = await this.tendersService.update(organizationId(req), actorId(req), params.id, body, meta(req));
    sendSuccess(res, { message: "Tender updated", data: tender });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const result = await this.tendersService.remove(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Tender deleted", data: result });
  });

  restore = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const tender = await this.tendersService.restore(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Tender restored", data: tender });
  });

  listAudit = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const query = req.validated?.query as ListQuery;
    const page = await this.tendersService.listAudit(organizationId(req), params.id, query.limit, query.cursor);
    sendSuccess(res, { message: "Tender audit log", data: page });
  });
}
