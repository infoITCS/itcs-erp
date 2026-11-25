import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import type { ListQuery } from "../../common/pagination/list-query";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { ProjectsService } from "./service";
import type { CreateProjectInput, ProjectListQuery, UpdateProjectInput } from "./validation";

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

export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as ProjectListQuery;
    const page = await this.projectsService.list(organizationId(req), query, req.auth?.permissions ?? []);
    sendSuccess(res, { message: "Projects", data: page });
  });

  formOptions = asyncHandler(async (req: Request, res: Response) => {
    const options = await this.projectsService.formOptions(organizationId(req));
    sendSuccess(res, { message: "Project form options", data: options });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as CreateProjectInput;
    const project = await this.projectsService.create(organizationId(req), actorId(req), body, meta(req));
    sendSuccess(res, { message: "Project created", data: project }, 201);
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const project = await this.projectsService.get(organizationId(req), params.id);
    sendSuccess(res, { message: "Project", data: project });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdateProjectInput;
    const project = await this.projectsService.update(organizationId(req), actorId(req), params.id, body, meta(req));
    sendSuccess(res, { message: "Project updated", data: project });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const result = await this.projectsService.remove(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Project deleted", data: result });
  });

  financials = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const financials = await this.projectsService.financials(organizationId(req), params.id, {
      permissions: req.auth?.permissions ?? [],
      roles: req.auth?.roles ?? [],
    });
    sendSuccess(res, { message: "Project financials", data: financials });
  });

  activity = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const activity = await this.projectsService.activity(organizationId(req), params.id, {
      permissions: req.auth?.permissions ?? [],
      roles: req.auth?.roles ?? [],
    });
    sendSuccess(res, { message: "Project customer activity", data: activity });
  });

  listAudit = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const query = req.validated?.query as ListQuery;
    const page = await this.projectsService.listAudit(organizationId(req), params.id, query.limit, query.cursor);
    sendSuccess(res, { message: "Project audit log", data: page });
  });
}
