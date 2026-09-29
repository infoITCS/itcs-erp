import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { OrganizationsService } from "./service";

export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.userId) {
      throw new UnauthorizedError();
    }
    const organizations = await this.organizationsService.listForUser(req.auth.userId);
    sendSuccess(res, { message: "Organizations", data: organizations });
  });
}
