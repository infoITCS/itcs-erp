import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { AuditLogsService } from "./service";
import type { AuditListQuery } from "./validation";

export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.organizationId) {
      throw new UnauthorizedError();
    }
    const query = req.validated?.query as AuditListQuery;
    const page = await this.auditLogsService.list(req.auth.organizationId, query.limit, query.cursor, {
      module: query.module,
      entityType: query.entityType,
      entityId: query.entityId,
      subjectId: query.subjectId,
    });
    sendSuccess(res, { message: "Audit logs", data: page });
  });
}
