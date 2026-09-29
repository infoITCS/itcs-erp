import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RolesService } from "./service";

export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.organizationId) {
      throw new UnauthorizedError();
    }
    const roles = await this.rolesService.list(req.auth.organizationId);
    sendSuccess(res, { message: "Roles", data: roles });
  });
}
