import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { sendSuccess } from "../../common/utils/api-response";
import { asyncHandler } from "../../common/utils/async-handler";
import type { AnalyticsService } from "./service";
import type { AnalyticsQuery } from "./validation";

function organizationId(req: Request): string {
  if (!req.auth?.organizationId) {
    throw new UnauthorizedError();
  }
  return req.auth.organizationId;
}

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  get = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as AnalyticsQuery;
    const report = await this.analyticsService.get(
      organizationId(req),
      req.auth?.permissions ?? [],
      query.range,
    );
    sendSuccess(res, { message: "Analytics", data: report });
  });
}
