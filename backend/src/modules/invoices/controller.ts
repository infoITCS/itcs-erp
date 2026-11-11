import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors/app-error";
import type { ListQuery } from "../../common/pagination/list-query";
import { asyncHandler } from "../../common/utils/async-handler";
import { sendSuccess } from "../../common/utils/api-response";
import type { RequestMeta } from "../auth/types";
import type { InvoicesService } from "./service";
import type {
  ChangeInvoiceStatusInput,
  CreateInvoiceInput,
  InvoiceListQuery,
  UpdateInvoiceInput,
} from "./validation";

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

export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validated?.query as InvoiceListQuery;
    const page = await this.invoicesService.list(organizationId(req), query, req.auth?.permissions ?? []);
    sendSuccess(res, { message: "Invoices", data: page });
  });

  formOptions = asyncHandler(async (req: Request, res: Response) => {
    const options = await this.invoicesService.formOptions(organizationId(req));
    sendSuccess(res, { message: "Invoice form options", data: options });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated?.body as CreateInvoiceInput;
    const invoice = await this.invoicesService.create(organizationId(req), actorId(req), body, meta(req));
    sendSuccess(res, { message: "Invoice created", data: invoice }, 201);
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const invoice = await this.invoicesService.get(organizationId(req), params.id);
    sendSuccess(res, { message: "Invoice", data: invoice });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as UpdateInvoiceInput;
    const invoice = await this.invoicesService.update(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Invoice updated", data: invoice });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const result = await this.invoicesService.remove(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Invoice deleted", data: result });
  });

  restore = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const invoice = await this.invoicesService.restore(organizationId(req), actorId(req), params.id, meta(req));
    sendSuccess(res, { message: "Invoice restored", data: invoice });
  });

  changeStatus = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const body = req.validated?.body as ChangeInvoiceStatusInput;
    const invoice = await this.invoicesService.changeStatus(
      organizationId(req),
      actorId(req),
      params.id,
      body,
      meta(req),
    );
    sendSuccess(res, { message: "Invoice status updated", data: invoice });
  });

  listAudit = asyncHandler(async (req: Request, res: Response) => {
    const params = req.validated?.params as { id: string };
    const query = req.validated?.query as ListQuery;
    const page = await this.invoicesService.listAudit(
      organizationId(req),
      params.id,
      query.limit,
      query.cursor,
    );
    sendSuccess(res, { message: "Invoice audit log", data: page });
  });
}
