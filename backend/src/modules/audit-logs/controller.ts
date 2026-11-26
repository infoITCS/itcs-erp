import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { AuditLogsService } from "./service";
import type { AuditListQuery, AuditRetentionBody } from "./validation";

export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.organizationId) {
      throw new UnauthorizedError();
    }
    const query = req.validated?.query as AuditListQuery;
    const dateRange = query.date
      ? {
          from: new Date(`${query.date}T00:00:00.000Z`),
          to: new Date(`${query.date}T23:59:59.999Z`),
        }
      : query.from || query.to
        ? {
            ...(query.from ? { from: new Date(query.from) } : {}),
            ...(query.to ? { to: new Date(query.to) } : {}),
          }
        : undefined;
    const page = await this.auditLogsService.list(req.auth.organizationId, query.limit, query.cursor, {
      module: query.module,
      entityType: query.entityType,
      entityId: query.entityId,
      subjectId: query.subjectId,
      dateRange,
    });
    sendSuccess(res, { message: "Audit logs", data: page });
  });

  getRetention = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.organizationId) {
      throw new UnauthorizedError();
    }
    const view = await this.auditLogsService.getRetentionView(req.auth.organizationId);
    sendSuccess(res, { message: "Audit retention policy", data: view });
  });

  updateRetention = asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth?.organizationId || !req.auth.userId) {
      throw new UnauthorizedError();
    }
    const body = req.validated?.body as AuditRetentionBody;
    const view = await this.auditLogsService.updateRetentionDays(
      req.auth.organizationId,
      req.auth.userId,
      body.retentionDays,
      { ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null },
    );
    sendSuccess(res, { message: "Audit retention policy updated", data: view });
  });
}
