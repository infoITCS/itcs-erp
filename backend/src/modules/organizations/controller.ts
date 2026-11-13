import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { OrganizationsService, UpdateOrganizationInput } from "./service";

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

function actorId(req: Request): string {
  if (!req.auth?.userId) {
    throw new UnauthorizedError();
  }
  return req.auth.userId;
}

export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const organizations = await this.organizationsService.listForUser(actorId(req));
    sendSuccess(res, { message: "Organizations", data: organizations });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as UpdateOrganizationInput;
    const organization = await this.organizationsService.update(
      organizationId(req),
      actorId(req),
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Organization updated", data: organization });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await this.organizationsService.archive(
      organizationId(req),
      actorId(req),
      meta(req),
    );
    sendSuccess(res, {
      message: "Organization deleted. Its members no longer have access.",
    });
  });
}
