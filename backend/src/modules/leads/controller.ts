import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import type { ListQuery } from "../../common/pagination/list-query";
import { sendSuccess } from "../../common/utils/api-response";
import { asyncHandler } from "../../common/utils/async-handler";
import type { RequestMeta } from "../auth/types";
import type { LeadsService } from "./service";
import type {
  ChangeLeadStatusInput,
  ConvertLeadInput,
  CreateLeadInput,
  LeadAnalyticsQuery,
  LeadListQuery,
  UpdateLeadInput,
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

export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as LeadListQuery;
    const page = await this.leadsService.list(organizationId(req), query, req.auth?.permissions ?? []);
    sendSuccess(res, { message: "Leads", data: page });
  });

  analytics = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as LeadAnalyticsQuery;
    const report = await this.leadsService.analytics(organizationId(req), query.period);
    sendSuccess(res, { message: "Lead analytics", data: report });
  });

  formOptions = asyncHandler(async (req: Request, res: Response) => {
    const options = await this.leadsService.formOptions(organizationId(req));
    sendSuccess(res, { message: "Lead form options", data: options });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as CreateLeadInput;
    const lead = await this.leadsService.create(organizationId(req), actorId(req), body, meta(req));
    sendSuccess(res, { message: "Lead created", data: lead }, 201);
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const lead = await this.leadsService.get(organizationId(req), params.id);
    sendSuccess(res, { message: "Lead", data: lead });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdateLeadInput;
    const lead = await this.leadsService.update(organizationId(req), actorId(req), params.id, body, meta(req));
    sendSuccess(res, { message: "Lead updated", data: lead });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const result = await this.leadsService.remove(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Lead deleted", data: result });
  });

  restore = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const lead = await this.leadsService.restore(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Lead restored", data: lead });
  });

  changeStatus = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as ChangeLeadStatusInput;
    const lead = await this.leadsService.changeStatus(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Lead status updated", data: lead });
  });

  convert = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as ConvertLeadInput;
    const lead = await this.leadsService.convert(organizationId(req), actorId(req), params.id, body, meta(req));
    sendSuccess(res, { message: "Lead converted", data: lead }, 201);
  });

  listAudit = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const query = req.validated?.query as ListQuery;
    const page = await this.leadsService.listAudit(organizationId(req), params.id, query.limit, query.cursor);
    sendSuccess(res, { message: "Lead audit log", data: page });
  });
}
