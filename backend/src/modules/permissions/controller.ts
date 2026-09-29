import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { PermissionsService } from "./service";

export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  list = asyncHandler(async (_req: Request, res: Response) => {
    const permissions = await this.permissionsService.list();
    sendSuccess(res, { message: "Permissions", data: permissions });
  });
}
