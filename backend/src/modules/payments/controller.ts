import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import type { ListQuery } from "../../common/pagination/list-query";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { PaymentsService } from "./service";
import type { CreatePaymentInput, PaymentListQuery, UpdatePaymentInput } from "./validation";

function meta(req: Request): RequestMeta {
  return { ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
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

export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as PaymentListQuery;
    const page = await this.paymentsService.list(organizationId(req), query);
    sendSuccess(res, { message: "Payments", data: page });
  });

  formOptions = asyncHandler(async (req: Request, res: Response) => {
    const options = await this.paymentsService.formOptions(organizationId(req));
    sendSuccess(res, { message: "Payment form options", data: options });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as CreatePaymentInput;
    const payment = await this.paymentsService.create(organizationId(req), actorId(req), body, meta(req));
    sendSuccess(res, { message: "Payment recorded", data: payment }, 201);
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const payment = await this.paymentsService.get(organizationId(req), params.id);
    sendSuccess(res, { message: "Payment", data: payment });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdatePaymentInput;
    const payment = await this.paymentsService.update(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Payment updated", data: payment });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const result = await this.paymentsService.remove(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Payment deleted", data: result });
  });

  listAudit = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const query = req.validated?.query as ListQuery;
    const page = await this.paymentsService.listAudit(
      organizationId(req),
      params.id,
      query.limit,
      query.cursor,
    );
    sendSuccess(res, { message: "Payment audit log", data: page });
  });
}
