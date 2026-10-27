import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { RolesService } from "./service";
import type { RoleInput, UpdateRoleInput } from "./types";

function meta(req: Request): RequestMeta {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  };
}

function organizationId(req: Request): string {
  if (!req.auth?.organizationId) {
    throw new UnauthorizedError();
  }
  return req.auth.organizationId;
}

export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const roles = await this.rolesService.list(organizationId(req));
    sendSuccess(res, { message: "Roles", data: roles });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const role = await this.rolesService.get(organizationId(req), params.id);
    sendSuccess(res, { message: "Role", data: role });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as RoleInput;
    const role = await this.rolesService.create(
      organizationId(req),
      req.auth?.userId ?? "",
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Role created", data: role }, 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdateRoleInput;
    const role = await this.rolesService.update(
      organizationId(req),
      req.auth?.userId ?? "",
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Role updated", data: role });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    await this.rolesService.delete(
      organizationId(req),
      req.auth?.userId ?? "",
      params.id,
      meta(req),
    );
    sendSuccess(res, { message: "Role deleted" });
  });
}
