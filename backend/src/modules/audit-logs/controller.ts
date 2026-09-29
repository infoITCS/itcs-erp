import type { Request, Response } from "express";
import type { ListQuery } from "../../common/pagination/list-query";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { AuditLogsService } from "./service";

export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.organizationId) {
      throw new UnauthorizedError();
    }
    const query = req.validated?.query as ListQuery;
    const page = await this.auditLogsService.list(req.auth.organizationId, query.limit, query.cursor);
    sendSuccess(res, { message: "Audit logs", data: page });
  });
}
