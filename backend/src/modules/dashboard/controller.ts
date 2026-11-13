import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { sendSuccess } from "../../common/utils/api-response";
import { asyncHandler } from "../../common/utils/async-handler";
import type { DashboardService } from "./service";

function organizationId(req: Request): string {
  if (!req.auth?.organizationId) {
    throw new UnauthorizedError();
  }
  return req.auth.organizationId;
}

export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  get = asyncHandler(async (req: Request, res: Response) => {
    const summary = await this.dashboardService.get(
      organizationId(req),
      req.auth?.permissions ?? [],
    );
    sendSuccess(res, { message: "Dashboard summary", data: summary });
  });
}
